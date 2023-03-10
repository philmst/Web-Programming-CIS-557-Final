const express = require('express');
const path = require('path');

const cors = require('cors');

const webapp = express();

const userLib = require('./userTableDatabase');
const profileLib = require('./profileTableDatabase');
const postLib = require('./postTableDatabase');
const groupLib = require('./groupTableDatabase');
const notifLib = require('./notificationTableDatabase');
const adminLib = require('./adminTableDatabase');
const replyLib = require('./replyTableDatabase');
const inviteLib = require('./invitationTableDatabase');
const groupMemberLib = require('./groupMemberTableDatabase');
const msgLib = require('./messageTableDatabase');
const convoLib = require('./convoTableDatabase');

const port = process.env.PORT || 8080;

webapp.use(express.json());
webapp.use(
  express.urlencoded({
    extended: true,
  }),
);
webapp.use(cors());
webapp.use(express.static(path.join(__dirname, './client/build')));

let userDb;
let profileDb;
let postDb;
let groupDb;
let notifDb;
let adminDb;
let replyDb;
let inviteDb;
let groupMemberDb;
let msgDb;
let convoDb;

webapp.listen(port, async () => {
  userDb = await userLib.connect();
  profileDb = await profileLib.connect();
  postDb = await postLib.connect();
  groupDb = await groupLib.connect();
  notifDb = await notifLib.connect();
  adminDb = await adminLib.connect();
  replyDb = await replyLib.connect();
  inviteDb = await inviteLib.connect();
  groupMemberDb = await groupMemberLib.connect();
  msgDb = await msgLib.connect();
  convoDb = await convoLib.connect();
  // eslint-disable-next-line no-console
  console.log('listening');
});

webapp.post('/registration', async (req, res) => {
  try {
    const nextId = await userLib.getNextId(userDb);
    const newUser = {
      user_id: nextId + 1,
      user_name: req.body.user_name,
      user_password: req.body.user_password,
    };
    const newProfile = {
      user_id: nextId + 1,
      first_name: '',
      last_name: '',
      biography: '',
      profile_picture_url: '',
    };
    const resultsUser = await userLib.addUser(userDb, newUser);
    if (resultsUser === null) {
      res.status(400).json({ err: 'username already taken' });
    } else {
      profileLib.addProfile(profileDb, newProfile);

      res.status(201).json({
        user: newUser,
        profile: newProfile,
      });
    }
  } catch (err) {
    res.status(400).json({ err: 'error in registration' });
  }
});

webapp.post('/login', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('login a user');
  try {
    const name = req.body.user_name;
    const resultsUser = await userLib.getUsersWithName(userDb, name);

    // checks to make sure we don't have to get locked out
    if (req.body.attempt >= 2) {
      await userLib.lockoutUser(userDb, resultsUser[0].user_id);
      res.status(404).json({ err: 'jail' });
      return;
    }

    // check if we are locked out
    if (resultsUser.length !== 0 && resultsUser[0].locked_out !== null) {
      // we do be locked out

      const locked = new Date(resultsUser[0].locked_out);
      const now = new Date();
      if (now - locked >= 1800000) {
        // yay 30 minutes has passed
        userLib.unlockUser(userDb, resultsUser[0].user_id);
        // we can login as usual
      } else {
        res.status(404).json({ err: 'locked' });
        return;
      }
    }

    if (resultsUser.length === 0) {
      res.status(404).json({ err: 'User does not exist' });
    } else if (req.body.user_password.includes(resultsUser[0].user_password)) {
      const profile = await profileLib.getProfileById(profileDb, resultsUser[0].user_id);
      res.status(200).json({
        profile: profile[0],
      });
    } else {
      res.status(404).json({ err: 'Incorrect password' });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
});

webapp.get('/post/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // assign to res.status

    const postList = await postLib.getUserPosts(postDb, id);
    // eslint-disable-next-line no-console
    console.log('returning postList from webserver of: ', postList);
    res.status(200).json(postList);
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
});

webapp.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // assign to res.status
    const profileInfo = await profileLib.getProfileById(profileDb, id);
    res.status(200).json(profileInfo);
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
});

webapp.delete('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // assign to res.status
    const numDeletedProfiles = await profileLib.deleteProfile2(profileDb, id);
    res.status(200).json(numDeletedProfiles);
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
});

webapp.post('/groups', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('create a group');
  try {
    const nextId = await groupLib.getNextId(groupDb);
    const newGroup = {
      group_id: nextId + 1,
      group_name: req.body.group_name,
      group_creator: req.body.group_creator,
      group_description: req.body.group_description,
      is_public: req.body.is_public,
    };

    const newTopics = {
      group_id: nextId + 1,
      topic_1: req.body.topic_1,
      topic_2: req.body.topic_2,
      topic_3: req.body.topic_3,
    };

    const resultsGroup = await groupLib.addGroup(groupDb, newGroup);
    if (resultsGroup === null) {
      res.status(404).json({ err: 'groupname already taken' });
      return null;
    }

    const userId = await userLib.getUserById(userDb, newGroup.group_creator);
    await groupMemberLib.addGroupMember(groupMemberDb, newGroup.group_id, newGroup.group_creator);
    await adminLib.addAdminForGroup(
      adminDb,
      newGroup.group_id,
      userId[0].user_id,
      1,
      userId[0].user_name,
    );
    await notifLib.addNotification(
      notifDb,
      userId[0].user_id,
      { isRead: false, msg: `Congratulations! You are now the creator and admin of the group ${newGroup.group_name}` },
    );

    const resultsTopics = await groupLib.addTopics(groupDb, newTopics);

    res.status(201).json({
      group: newGroup,
    });
    return resultsTopics;
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.get('/groups/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get one group groups');

  try {
    const groups = await groupLib.getGroupById(groupDb, req.params.id);
    if (groups === null) {
      res.status(404).json({ err: 'no groups found' });
    } else {
      res.status(200).json(groups);
    }
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/groups', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get groups');

  try {
    const groups = await groupLib.getGroups(groupDb);
    if (groups === null) {
      res.status(404).json({ err: 'no groups found' });
    } else {
      res.status(200).json({ result: groups });
    }
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/topics/:topic/:sort', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get all groups with topic');

  const { topic } = req.params;
  const { sort } = req.params;
  try {
    if (topic === 'all') {
      const groups = await groupLib.getPublicGroups(groupDb, sort);
      res.status(200).json({ groups });
      return;
    }
    const groups = await groupLib.getGroupsWithTopic(groupDb, topic);

    res.status(200).json({ groups });
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/topics', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get all unique topics');

  try {
    const groups = await groupLib.getTopics(groupDb);
    res.status(200).json({ topics: groups });
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/user/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('retrieve user information for supplied id, with id of: ', req.params.id);
  try {
    const { id } = req.params;
    const userInfo = await userLib.getUserById(userDb, id);
    // eslint-disable-next-line no-console
    console.log('retrieved user info from model, current at webserver/user/id/get, value of: ', userInfo);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/user/id/get');
  }
});

webapp.get('/user/lockout/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('lockout user with id of ', req.params.id);
  try {
    const { id } = req.params;
    const userInfo = await userLib.getUserById(userDb, id);
    // eslint-disable-next-line no-console
    console.log('locked out user, return val: ', userInfo);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/user/id/get');
  }
});

webapp.get('/user-by-name/:name', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('in webserver, retrieve user information for supplied name of: ', req.params.name);
  try {
    const { name } = req.params;
    const userInfo = await userLib.getUsersWithName(userDb, name);
    // eslint-disable-next-line no-console
    console.log('retrieved user info from model, current at webserver/user/name/get, value of: ', userInfo);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/user/name/get');
  }
});

webapp.put('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userPassword = req.body.user_password;
    // get password from body not params!
    const userInfo = await userLib.updateUser(userDb, id, 'user_password', userPassword);

    if (typeof userInfo.err !== 'undefined') {
      res.status(404).json(userInfo);
      return;
    }

    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/user/id/put');
  }
});

webapp.delete('/user/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('make it to webserver/user/id/delete with ', req.params);
  try {
    const { id } = req.params;
    const deletedRows = await userLib.deleteUser(userDb, id);
    res.status(200).json(deletedRows);
  } catch (err) {
    res.status(404).json('error! at webserver/user/id/delete');
  }
});

// this one only updates the bio.
// I originally tried to make it a dynamic variable update, but had issues.
webapp.put('/profile/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('make it to webserver/webapp.put/profile/id with params: ', req.params);
  try {
    const { id } = req.params;
    const { biography } = req.body;
    // get password from body not params!
    const userInfo = await profileLib.updateProfile(profileDb, id, biography);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/profile/id/put');
  }
});

// this updates the profile pic
webapp.put('/profile-pic/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('make it to webserver/webapp.put/profile-pic/id with params: ', req.params);
  try {
    const { id } = req.params;
    const { profilePictureURL } = req.body;
    // get password from body not params!
    const userInfo = await profileLib.updateProfilePic(profileDb, id, profilePictureURL);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/profile-pic/id/put');
  }
});

webapp.get('/notifications/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get notifications');
  const { id } = req.params;
  try {
    const notifications = await notifLib.getNotifications(notifDb, id);

    // eslint-disable-next-line no-console
    console.log('got notifications: ', notifications);
    res.status(200).json(notifications);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/notifications/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('POST notifications, ', req.params, req.body.notification);
  const { id } = req.params;
  try {
    const notifications = await notifLib.addNotification(notifDb, id, req.body.notification);

    // eslint-disable-next-line no-console
    console.log('got notifications: ', notifications);
    res.status(201);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

// get all pending invitations (for a person I think)
webapp.get('/invitations/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get invitations');
  const { id } = req.params;
  try {
    const invitations = await inviteLib.getPendingInvitations(inviteDb, id);

    // eslint-disable-next-line no-console
    // console.log('got invitations: ', invitations);
    res.status(200).json(invitations);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

// get all pending OR accepted invitations for a group
webapp.get('/invitations-open/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get open invitations');
  const { id } = req.params;
  try {
    const openInvites = await inviteLib.getOpenInvitesByGroupId(inviteDb, id);
    res.status(200).json(openInvites);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/invitations/', async (req, res) => {
  // const { id } = req.params;
  // eslint-disable-next-line no-console
  // console.log('post invitations with params of: ', req.params);
  const {
    fromUserId, toUserId, groupId, invitationStatus,
  } = req.body;
  const invitationObject = {
    fromUserId,
    toUserId,
    groupId,
    invitationStatus,
  };
  try {
    await inviteLib.addInvitation(inviteDb, invitationObject);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('error! ', err);
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.put('/invitations/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('put invitations');
  const { id } = req.params;
  const { newStatus } = req.body;
  try {
    const updateCount = await inviteLib.updateInvitationStatus(inviteDb, id, newStatus);

    // eslint-disable-next-line no-console
    console.log('updated ', updateCount, 'invitations.');
    res.status(200).json(updateCount);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.delete('/invitations/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('deleting invitations');
  const { id } = req.params;
  try {
    const numDeletedInvites = await inviteLib.deletePendingInvites(inviteDb, id);
    res.status(200).json(numDeletedInvites);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/membership/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('post group membership to accept invitations, webserver, with req.body of:', req.body);

  const { id } = req.params;
  const userId = req.body.id;
  try {
    const postReturn = await groupMemberLib.addGroupMember(groupMemberDb, id, userId);
    res.status(200).json(postReturn);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/membership/:id', async (req, res) => {
  try {
    const membershipList = await groupMemberLib.getMemberIds(groupMemberDb, req.params.id);
    res.status(200).json(membershipList);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/membership-of-user/:id', async (req, res) => {
  try {
    const sDB = groupMemberDb;
    const usId = req.params.id;
    const membershipList = await groupMemberLib.getGroupMembershipsByUserId(sDB, usId);
    res.status(200).json(membershipList);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

// deletes ALL the membership associated with a user id
webapp.delete('/membership/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`deleting memberships with userid ${JSON.stringify(req.params.id)}`);
  try {
    const result = await groupMemberLib.deleteUserMemberships(groupMemberDb, req.params.id);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

// deletes the membership of one group-user pair. Takes group id in param, userid in body
webapp.delete('/leave-group/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('deleting single membership of userid with req body of ', req.body);
  const groupId = req.params.id;
  const { userId } = req.body;
  try {
    const result = await groupMemberLib.deleteSingleMembership(groupMemberDb, groupId, userId);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.post('/admins', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('POST admins, ', req.body.admin);
  try {
    const userId = await userLib.getUsersWithName(userDb, req.body.admin.adminUser);

    const memberIds = await groupMemberLib.getMemberIds(groupMemberDb, req.body.admin.groupId);
    let seen = false;
    for (let i = 0; i < memberIds.length; i += 1) {
      if (memberIds[i].member_id === userId[0].user_id) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      // user is not member of group yet
      res.status(400).json({ err: 'user is not member of group' });
      return;
    }

    const admin = await adminLib.addAdminForGroup(
      adminDb,
      req.body.admin.groupId,
      userId[0].user_id,
      req.body.admin.isCreator,
      req.body.admin.adminUser,
    );

    await notifLib.addNotification(notifDb, userId[0].user_id, { notification: { isRead: 0, msg: `Congratulations! You were promoted to admin of group: ${req.body.admin.groupName}` } });
    // eslint-disable-next-line no-console
    console.log('got admin: ', admin);
    res.status(201).json(admin);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

// gets all admins for a particular group (e.g. id here is group, not user)
webapp.get('/admins/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get admins');
  try {
    const admin = await adminLib.getAdmins(adminDb, req.params.id);

    // eslint-disable-next-line no-console
    console.log('got admins: ', admin);
    res.status(200).json(admin);
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.delete('/admins/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('delete administrator records for deactivated user');
  try {
    const admin = await adminLib.deleteAdmins(adminDb, req.params.id);

    res.status(200).json(admin);
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/admins', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get all admins');
  try {
    const admins = await adminLib.getAllAdmins(adminDb);

    // eslint-disable-next-line no-console
    console.log('got all admins: ', admins);
    res.status(200).json(admins);
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/administered-groups/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get all groups that the given userId administers');
  try {
    const administeredGroups = await adminLib.getAdministeredGroups(req.params.id);
    res.status(200).json(administeredGroups);
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.delete('/admins', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('delete admin');
  try {
    const admin = await adminLib.revokeAdmin(adminDb, req.query.groupId, req.query.adminUser);

    // eslint-disable-next-line no-console
    console.log('removed admin: ', admin);

    if (typeof admin.err !== 'undefined') {
      res.status(400).json(admin.err);
      return;
    }

    await notifLib.addNotification(notifDb, admin[0].admin_id, { isRead: 0, msg: `You were removed as admin from ${req.query.groupName}. Too bad so sad :(` });

    res.status(200).json(admin);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/post/text', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('create a group post');
  try {
    const nextId = await postLib.getNextId(postDb);
    const newPost = {
      post_id: nextId + 1,
      post_group: req.body.post_group,
      posting_user: req.body.posting_user,
      caption: req.body.caption,
      posting_username: req.body.posting_username,
    };

    const result = await postLib.addTextPost(postDb, newPost);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        post: newPost,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.post('/post/image', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('create a group post');
  try {
    const nextId = await postLib.getNextId(postDb);
    const newPost = {
      post_id: nextId + 1,
      post_group: req.body.post_group,
      posting_user: req.body.posting_user,
      caption: req.body.caption,
      photourl: req.body.photourl,
      posting_username: req.body.posting_username,
    };

    const result = await postLib.addImagePost(postDb, newPost);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        post: newPost,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.post('/post/audio', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('create a group post');
  try {
    const nextId = await postLib.getNextId(postDb);
    const newPost = {
      post_id: nextId + 1,
      post_group: req.body.post_group,
      posting_user: req.body.posting_user,
      caption: req.body.caption,
      audioUrl: req.body.audioUrl,
      posting_username: req.body.posting_username,
    };

    const result = await postLib.addAudioPost(postDb, newPost);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        post: newPost,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.post('/post/video', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('create a group post');
  try {
    const nextId = await postLib.getNextId(postDb);
    const newPost = {
      post_id: nextId + 1,
      post_group: req.body.post_group,
      posting_user: req.body.posting_user,
      caption: req.body.caption,
      videoUrl: req.body.videoUrl,
      posting_username: req.body.posting_username,
    };

    const result = await postLib.addVideoPost(postDb, newPost);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        post: newPost,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.get('/post/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get post by id');
  const { id } = req.params;
  try {
    const post = await postLib.getPostById(postDb, id);

    res.status(200).json({ post });
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.get('/flag-post/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`get flagged posts for user with id ${req.params.id}`);
  const id = parseInt(req.params.id, 10);
  try {
    const getGroups = await groupMemberLib.getGroupsForUser(groupDb, id);

    const adminFor = [];
    for (let i = 0; i < getGroups.length; i += 1) {
      const admin = await adminLib.getAdmins(groupDb, getGroups[i]);
      for (let j = 0; j < admin.length; j += 1) {
        if (admin[j].admin_id === id) {
          adminFor.push(getGroups[i]);
        }
      }
    }
    const flaggedPosts = [];
    for (let k = 0; k < adminFor.length; k += 1) {
      const posts = await postLib.getPosts(postDb, adminFor[k]);
      for (let m = 0; m < posts[0].length; m += 1) {
        const flags = await postLib.isFlagged(postDb, posts[0][m].post_id);
        if (flags.length !== 0) {
          const group = await groupLib.getGroupById(groupDb, adminFor[k]);
          const user = await userLib.getUserById(userDb, flags[0].flagging_user);
          posts[0][m].flagger = flags[0].flagging_user;
          posts[0][m].flaggerName = user[0].user_name;
          posts[0][m].groupName = group.group_name;
          flaggedPosts.push(posts[0][m]);
        }
      }
    }

    res.status(200).json({ flaggedPosts });
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.put('/flag-post/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`flag a group post with id ${JSON.stringify(req.params.id)}`);

  const {
    flaggerId,
    flaggerName,
    groupId,
    groupName,
  } = req.body;
  try {
    const result = await postLib.flagPost(postDb, req.params.id, flaggerId);

    const admins = await adminLib.getAdmins(adminDb, groupId);
    for (let i = 0; i < admins.length; i += 1) {
      await notifLib.addNotification(
        notifDb,
        admins[i].admin_id,
        { isRead: false, msg: `A post has been flagged in your group, ${groupName}, by ${flaggerName}. Please view the flagged posts page to resolve.` },
      );
    }

    if (result === null) {
      res.status(404).json({ err: 'oh no! something went wrong' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.delete('/flag-post/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`flag a group post with id ${JSON.stringify(req.params.id)}`);

  const { flaggerId, deleted } = req.body;
  try {
    const result = await postLib.removePostFlag(postDb, req.params.id);
    const id = await postLib.getPostById(postDb, req.params.id);
    if (deleted === 1) {
      await postLib.deletePost(postDb, req.params.id);

      // notify the author and flagger
      await notifLib.addNotification(
        notifDb,
        flaggerId,
        { isRead: false, msg: 'Congrats! A post YOU flagged was deleted by an admin. Great work.' },
      );
      await notifLib.addNotification(
        notifDb,
        id[0][0].posting_user,
        { isRead: false, msg: 'Oh no, a post you made was flagged by a user and deleted by an admin. Maybe watch what you are posting...' },
      );

      if (result === null) {
        res.status(404).json({ err: 'oh no! something went wrong' });
      } else {
        res.status(200).json({
          result,
        });
      }
    } else {
      // kept the post
      // notify the flagger
      await notifLib.addNotification(
        notifDb,
        flaggerId,
        { isRead: false, msg: 'Sorry, a post YOU flagged was NOT deleted by the admin. Guess it was not thaaaaat bad...' },
      );
      res.status(200).json({});
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('err: error');
  }
  return null;
});

webapp.put('/hide-post/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`hide a group post with id ${JSON.stringify(req.params.id)}`);
  try {
    const result = await postLib.hidePost(postDb, req.params.id);

    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.delete('/post/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`deleting a group post with id ${JSON.stringify(req.params.id)}`);
  try {
    const result = await postLib.deletePost(postDb, req.params.id);

    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.get('/posts/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get posts');

  try {
    const posts = await postLib.getPosts(postDb, req.params.id);
    if (posts === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(200).json({ result: posts });
    }
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/reply/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('edit reply');
  const { id } = req.params;
  const { caption } = req.body;
  try {
    await replyLib.editReply(replyDb, id, caption);
    res.status(200).json({});
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.post('/reply', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('create reply');
  try {
    const nextId = await replyLib.getNextId(replyDb);
    const newReply = {
      reply_id: nextId + 1,
      post_id: req.body.post_id,
      post_group: req.body.post_group,
      posting_user: req.body.posting_user,
      caption: req.body.caption,
    };

    const result = await replyLib.addReply(replyDb, newReply);
    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        reply: newReply,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.get('/replies/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get replies');

  try {
    const replies = await replyLib.getReplies(replyDb, req.params.id);
    if (replies === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(200).json({ result: replies });
    }
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/invitations-review/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('get invitations to review - in webserver.js');

  try {
    const invitations = await inviteLib.getInvitationsToReview(inviteDb, req.params.id);
    res.status(200).json(invitations);
  } catch (err) {
    res.status(404).json({ err: `error is ${err.message}` });
  }
});

webapp.put('/flag-reply/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`flag a reply with id ${JSON.stringify(req.params.id)}`);
  try {
    const result = await replyLib.flagReply(replyDb, req.params.id);

    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.put('/hide-reply/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`hide a reply with id ${JSON.stringify(req.params.id)}`);
  try {
    const result = await replyLib.hideReply(replyDb, req.params.id);

    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

webapp.delete('/reply/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log(`deleting a reply with id ${JSON.stringify(req.params.id)}`);
  try {
    const result = await replyLib.deleteReply(replyDb, req.params.id);

    if (result === null) {
      res.status(404).json({ err: 'err.message' });
    } else {
      res.status(201).json({
        result,
      });
    }
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
});

const msgPreprocessing = async (req) => {
  const { msg } = req.body;
  const { id } = req.params;
  // eslint-disable-next-line no-console
  console.log('POST message, ', id, msg);
  try {
    if (msg.toId === msg.fromId) {
      return { err: 'self' };
    }

    const myGroups = await groupMemberLib.getGroupsForUser(groupMemberDb, id);
    const theirGroups = await groupMemberLib.getGroupsForUser(groupMemberDb, msg.fromId);
    let same = false;
    for (let i = 0; i < myGroups.length; i += 1) {
      if (theirGroups.includes(myGroups[i])) {
        same = true;
        break;
      }
    }

    if (!same) {
      return { err: 'group' };
    }

    const exists = await convoLib.convoExists(convoDb, id, msg.fromId);
    let convoId;
    if (exists) {
      convoId = await convoLib.getConvoId(convoDb, id, msg.fromId);
    } else if (typeof msg.receiverName !== 'undefined') {
      // const userName = await userDb.getUserById(userDb, id);
      convoId = await convoLib.addConvo(convoDb, id, msg.fromId, msg.receiverName, msg.senderName);
    }
    return { convoId, id, msg };
  } catch (err) {
    return { err: err.message };
  }
};

webapp.post('/message/text/:id', async (req, res) => {
  const ret = await msgPreprocessing(req);
  if (typeof ret.err !== 'undefined') {
    res.status(404).json(ret);
    return;
  }
  const { msg, convoId, id } = ret;
  try {
    // renaming senderName for line length - think it was killing the max len
    const sndr = msg.senderName;
    const value = await msgLib.addTextMessage(msgDb, msg.txt, msg.fromId, id, sndr, convoId);

    // eslint-disable-next-line no-console
    console.log('created text msg: ', value);
    // TODO: will carry delivered receipt when we do level 3 task
    res.status(201).json({});
    return;
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/message/image/:id', async (req, res) => {
  const ret = await msgPreprocessing(req);
  if (typeof ret.err !== 'undefined') {
    res.status(404).json(ret);
    return;
  }
  const { msg, convoId, id } = ret;
  try {
    const sndr = msg.senderName;
    const value = await msgLib.addImageMessage(msgDb, msg.img, msg.fromId, id, sndr, convoId);

    // eslint-disable-next-line no-console
    console.log('created img msg: ', value);
    // TODO: will carry delivered receipt when we do level 3 task
    res.status(201).json({});
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/message/audio/:id', async (req, res) => {
  const ret = await msgPreprocessing(req);
  if (typeof ret.err !== 'undefined') {
    res.status(404).json(ret);
    return;
  }
  const { msg, convoId, id } = ret;
  try {
    const sndr = msg.senderName;
    const value = await msgLib.addAudioMessage(msgDb, msg.audio, msg.fromId, id, sndr, convoId);

    // eslint-disable-next-line no-console
    console.log('created audio msg: ', value);
    // TODO: will carry delivered receipt when we do level 3 task
    res.status(201).json({});
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.post('/message/video/:id', async (req, res) => {
  const ret = await msgPreprocessing(req);
  if (typeof ret.err !== 'undefined') {
    res.status(404).json(ret);
    return;
  }
  const { msg, convoId, id } = ret;
  try {
    const sndr = msg.senderName;
    const value = await msgLib.addVideoMessage(msgDb, msg.video, msg.fromId, id, sndr, convoId);

    // eslint-disable-next-line no-console
    console.log('created video msg: ', value);
    // TODO: will carry delivered receipt when we do level 3 task
    res.status(201).json({});
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/message/:id/:user', async (req, res) => {
  const { id, user } = req.params;
  try {
    const convo = await msgLib.getConversation(msgDb, id, user);

    // eslint-disable-next-line no-console
    console.log('got conversation: ', convo);
    res.status(200).json(convo);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/convo/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const convo = await convoLib.getConvosForUser(convoDb, id);

    // eslint-disable-next-line no-console
    console.log('got conversation: ', convo);
    res.status(200).json(convo);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/analytics-groups', async (req, res) => {
  try {
    const groupAnalyticsFacts = await groupLib.getAnalyticsFacts(groupDb);
    res.status(200).json(groupAnalyticsFacts);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('/analytics-posts', async (req, res) => {
  try {
    const postAnalyticsFacts = await postLib.getPostAnalyticsFacts(postDb);
    res.status(200).json(postAnalyticsFacts);
  } catch (err) {
    res.status(400).json({ err: `error is ${err.message}` });
  }
});

webapp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, './client/build/index.html'));
});

// for testing
module.exports = webapp;
