const database = require('../DatabaseModule');

// get list of accepted invitations to review
const getInvitationsToReview = async (userId) => {
  // call backend for list of invitations to review based on the userId
  const invitationsToReview = await database.sendGetRequest(`/invitations-review/${userId}`);
  return invitationsToReview;
};

// add to group members

const getPendingInvitations = async (id) => {
  const response = await database.sendGetRequest('/invitations/', { id });
  return response;
};

// get group names associated with group_id
const getGroupNames = async (invitations) => {
  // build array of promises for each invitation
  const groupNamePromises = [];
  for (let i = 0; i < invitations.length; i += 1) {
    const groupName = database.sendGetRequest('/groups/', { id: invitations[i].group_id });
    groupNamePromises.push(groupName);

    // if there is an error for any of them, return it
    if (groupName.err !== undefined) {
      // eslint-disable-next-line no-console
      console.log(groupName.err);
      return groupName;
    }
  }

  // await for all promises to resolve
  const groupNameArray = await Promise.all(groupNamePromises);

  const invitationsLocal = invitations;
  // loop through, adding group names to each invitation object
  for (let j = 0; j < groupNameArray.length; j += 1) {
    invitationsLocal[j].groupName = groupNameArray[j].group_name;
  }

  return invitationsLocal;
};

const putDecline = async (invitationId) => {
  const result = await database.sendPutRequest(`/invitations/${invitationId}`, { newStatus: 'declined' });
  return result;
};

const declineInvite = async (invitationId, invitationName, updateInvitations, updateMessage) => {
  // update operation on invitation to set the status to declined
  const result = await putDecline(invitationId);

  // update message
  updateMessage(`Declined invitation to  ${invitationName}`);

  // refetch/update invitations
  updateInvitations();
  return result;
};

const acceptHTTP = async (invitationId) => {
  // updating group in db taken from here. groupId, userId taken from params

  // update invitation in db
  const invitationURL = `/invitations/${invitationId}`;
  const invitationBody = { newStatus: 'accepted' };
  const resultInv = await database.sendPutRequest(invitationURL, invitationBody);

  // refetch/update invitations
  return resultInv;
};

const acceptInvite = async (invitation, updateInvitations, updateMessage) => {
  // update operation on invitation to set the status to declined
  const result = await acceptHTTP(invitation.invitation_id);

  // update message
  updateMessage(`Accepted invitation to  ${invitation.groupName}. An admin will now review your invitation!`);

  // refetch/update invitations
  updateInvitations();

  return result;
};

// for when admins approve an invitation that has already been accepted by the invitee
const approveInvite = async (invReview, updateInvitationsToReview, updateMessage) => {
  // get all members in a group
  const groupMembers = await database.sendGetRequest(`/membership/${invReview.group_id}`);

  // test if user is already in the group
  for (let i = 0; i < groupMembers.length; i += 1) {
    if (groupMembers[i].member_id === invReview.to_user_id) {
      updateMessage('This user is already in the group! You can safely decline the invitation');
      return;
    }
  }

  // add to group membership (already done)
  const groupMembershipURL = `/membership/${invReview.group_id}`;
  const postBody = { id: invReview.to_user_id };
  await database.sendPostRequest(groupMembershipURL, postBody);

  // update invitation status to approved
  const invitationURL = `/invitations/${invReview.invitation_id}`;
  const invitationBody = { newStatus: 'approved' };
  await database.sendPutRequest(invitationURL, invitationBody);

  // send notification to user
  const approveNotifURL = `/notifications/${invReview.to_user_id}`;
  const approvedNotifBody = { notification: { isRead: false, msg: `You've been approved to join ${invReview.group_name}!` } };
  await database.sendPostRequest(approveNotifURL, approvedNotifBody);

  // updateMessage
  updateMessage('You\'ve approved the user - and they\'ve been added to the group! Hurrah!');

  // refresh invitation page (invitations to review component)
  updateInvitationsToReview();
};

// for when admins decline/don't approve an invitation that has already been accepted by an invitee
const notApproveInvite = async (invReview, updateInvitationsToReview, updateMessage) => {
  // update invitation status to declined
  const invitationURL = `/invitations/${invReview.invitation_id}`;
  const invitationBody = { newStatus: 'declined' };
  const resultInv = await database.sendPutRequest(invitationURL, invitationBody);

  // send notification to user

  // updateMessage
  updateMessage('You\'ve declined the user - and they\'ve NOT been added to the group! Hurrah!');

  // refresh invitation page (invitations to review component)
  updateInvitationsToReview();

  return resultInv;
};

export {
  getPendingInvitations,
  getGroupNames,
  declineInvite,
  acceptInvite,
  getInvitationsToReview,
  approveInvite,
  notApproveInvite,
};
