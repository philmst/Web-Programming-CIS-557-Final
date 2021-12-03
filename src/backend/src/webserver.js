const express = require('express');
const bodyParser = require('body-parser');

const cors = require('cors');

const webapp = express();

webapp.use(cors());

const userLib = require('./userTableDatabase');
const profileLib = require('./profileTableDatabase');
const postLib = require('./postTableDatabase');
const postCommentLib = require('./postCommentsTableDatabase');
const groupLib = require('./groupTableDatabase');
const notifLib = require('./notificationTableDatabase');

const port = 8080;

webapp.use(bodyParser.urlencoded());
webapp.use(bodyParser.json());

webapp.use(express.urlencoded({
  extended: true,
}));

let userDb;
let profileDb;
let postDb;
let postCommentDb;
let groupDb;
let notifDb;

webapp.listen(port, async () => {
  userDb = await userLib.connect();
  profileDb = await profileLib.connect();
  postDb = await postLib.connect();
  postCommentDb = await postCommentLib.connect();
  groupDb = await groupLib.connect();
  notifDb = await notifLib.connect();
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
      res.status(404).json({ err: 'username already taken' });
    } else {
      profileLib.addProfile(profileDb, newProfile);

      res.status(201).json({
        user: newUser,
        profile: newProfile,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('testing to see if control gets to catch in webserver.js for rego post');
    // eslint-disable-next-line no-console
    console.log('testing to see if control gets to catch in webserver.js for rego post');
    res.status(404).json({ err: err.message });
  }
});

webapp.post('/login', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('login a user');
  try {
    const name = req.body.user_name;
    const resultsUser = await userLib.getUsersWithName(userDb, name);
    if (resultsUser[0].length === 0) {
      res.status(404).json({ err: 'User does not exist' });
    } else if (req.body.user_password.includes(resultsUser[0][0].user_password)) {
      // TODO: increase the number of characters that
      // are able to be stored for a password for more accuracy
      const profile = await profileLib.getProfileById(profileDb, resultsUser[0][0].user_id);
      res.status(200).json({
        profile: profile[0][0],
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

webapp.get('/comment/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // assign to res.status
    const commentList = await postCommentLib.getPostComments(postCommentDb, id);
    res.status(200).json(commentList);
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
});

webapp.post('/comment', async (req, res) => {
  try {
    const commentObj = {
      post_id: req.body.post_id,
      user_id: req.body.user_id,
      comment_txt: req.body.comment_txt,
    };
    const commentInsert = await postCommentLib.makeNewComment(postCommentDb, commentObj);
    res.status(200).json(commentInsert);
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
    } else {
      res.status(201).json({
        group: newGroup,
      });
    }

    const resultsTopics = await groupLib.addTopics(groupDb, newTopics);
    return resultsTopics;
  } catch (err) {
    res.status(404).json({ err: err.message });
  }
  return null;
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

webapp.put('/user/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('make it to webserver/webapp.put/user/id with params: ', req.params);
  try {
    const { id } = req.params;
    const { userPassword } = req.body;
    // get password from body not params!
    const userInfo = await userLib.updateUser(userDb, id, 'user_password', userPassword);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/user/id/put');
  }
});

webapp.put('/profile/:id', async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('make it to webserver/webapp.put/profile/id with params: ', req.params);
  try {
    const { id } = req.params;
    const { biography } = req.body;
    // get password from body not params!
    const userInfo = await profileLib.updateProfile(profileDb, id, 'biography', biography);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).json('error! at webserver/profile/id/put');
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

webapp.use((req, res) => {
  // eslint-disable-next-line no-console
  console.log('testing to see if control gets to webapp.use');
  res.status(404);
});
