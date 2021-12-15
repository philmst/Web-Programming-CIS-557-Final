import { useState, useEffect, React } from 'react';
import './InvitationPage.css';

const lib = require('./InvitationModule');

function InvitationPage(props) {
  const { changeState, state } = props;
  const [invitations, setInvitations] = useState([]);
  const [message, setMessage] = useState('test');

  const updateInvitations = async () => {
    let i = await lib.getPendingInvitations(state.userId);
    i = await lib.getGroupNames(i);

    // setInvitations([{ id: 1, groupName: 'testGroup!' }]);
    setInvitations(i);
  };

  const updateMessage = (newMessage) => {
    setMessage(newMessage);
  };

  // eslint-disable-next-line
  // console.log('invitations now at: ', invitations);

  useEffect(() => {
    updateInvitations();
  }, []);

  return (
    <div className="container">

      <div className="header">
        <div className="social-media-title">Social Media</div>
        <div className="profile-picture">
          <div className="img" />
        </div>
        <div className="username">Hi, username!</div>
      </div>

      <div className="top-navbar">
        <div className="home-link">Home</div>
        <div className="profile-link" onClick={() => props.changeState({ link: '/profile' })} onKeyDown={() => props.changeState({ link: '/profile' })} role="link" tabIndex={0}>Profile</div>
      </div>

      <div className="main-container">

        <div className="side-navbar">
          <button type="submit" className="notifications" onClick={() => changeState({ link: '/notifications' })}>Notifications</button>
          <button type="submit" className="events">Events</button>
          <button type="submit" className="groups" onClick={() => changeState({ link: '/groups' })}>Groups</button>
          <button type="submit" className="videos">Videos</button>
          <button type="submit" className="photos">Photos</button>
        </div>

        <div className="main-area">
          <div id="message">
            {message}
          </div>
          {invitations.map((inv) => (
            <div className="notification" key={inv.invitation_id}>
              <div className="title">
                Invitation
              </div>
              <div className="info">
                <div className="invite-message">
                  { `You have been invited to join group ${inv.groupName}. Do you accept?  ` }
                </div>
                <button className="accept-invitation" type="button" onClick={() => lib.acceptInvite(inv, updateInvitations, updateMessage, state.userId)}> Accept </button>
                <button className="decline-invitation" type="button" onClick={() => lib.declineInvite(inv.invitation_id, inv.groupName, updateInvitations, updateMessage)}> Decline </button>
              </div>
            </div>
          ))}

        </div>

        <div className="message-updates">
          Message updates
        </div>

      </div>
    </div>
  );
}

export default InvitationPage;
