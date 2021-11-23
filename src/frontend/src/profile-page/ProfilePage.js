import './ProfilePage.css';
import React, { useEffect, useState } from 'react';
// import { getProfile, getUserPosts } from './ProfileModule';
// import './ProfileModule.js';
// import '../DatabaseModule';
// import { ReactHtmlParser } from 'react-html-parser';
const database = require('../DatabaseModule');
// const profileModules = require('./ProfileModule');

// get comments for a post
const getPostsComments = async (posts) => {
  // iterate through each post, requesting its comments. Wait for all promises to resolve.
  const commentPromiseContainer = [];
  for (let i = 0; i < posts.length; i += 1) {
    // need to implement a get comments function first
    const postComments = database.sendGetRequest('http://localhost:8080/comment/', { id: posts[i].post_id });
    commentPromiseContainer.push(postComments);
  }
  const commentFulfilledContainer = await Promise.all(commentPromiseContainer);

  // assign the comments to each post in the array to hand back
  const postsArray = posts;
  for (let i = 0; i < commentFulfilledContainer.length; i += 1) {
    postsArray[i].comments = commentFulfilledContainer[i];
  }
  // return the array of posts which now each have the additional 'comments' property
  // comments property is itself an array of comment objects
  return postsArray;
};

const getProfile = async (userId) => {
  const profile = await database.sendGetRequest('http://localhost:8080/profile/', { id: userId });
  return profile;
};

const getNamesFromDB = async (postsToSet) => {
  // set up array of unique userIds for which to retrieve names from Db
  const userIdsToRetrieve = [];

  console.log('in get names, postsToSet are: ', postsToSet);

  // loop through and get the userIds of the comment-makers
  for (let i = 0; i < postsToSet.length; i += 1) {
    // console.log('in get outerloop names, postsToSet[i].comments are: ', postsToSet[i].comments);
    for (let j = 0; j < postsToSet[i].comments.length; j += 1) {
      if (userIdsToRetrieve.indexOf(postsToSet[i].comments[j].user_id) === -1) {
        userIdsToRetrieve.push(postsToSet[i].comments[j].user_id);
        // console.log('pushing ', postsToSet[i].comments[j].user_id, 'to userIdsToRetrieve');
      }
    }
  }

  // get the names associated with all the userIds needed on the page
  // console.log('about to go populate promise container with ', userIdsToRetrieve);
  const profilePromiseContainer = [];
  for (let i = 0; i < userIdsToRetrieve.length; i += 1) {
    const commenterProfile = getProfile(userIdsToRetrieve[i]);
    // console.log(' about to push ', commenterProfile, ' onto the profilePromiseContainer');
    profilePromiseContainer.push(commenterProfile);
  }

  console.log('profilePromiseContainer is ', profilePromiseContainer);
  const profileFulfilledContainer = await Promise.all(profilePromiseContainer);
  console.log('profileFulfilledContainer is ', profileFulfilledContainer);

  // taking one level off the array - not sure why it's got an extra nesting?
  const profilesToReturn = [];
  for (let i = 0; i < profileFulfilledContainer.length; i += 1) {
    profilesToReturn.push(profileFulfilledContainer[i][0][0]);
  }

  // attach the names to each comment
  const postsToReturn = postsToSet;
  console.log('profiles to return used to iteratively assign to posts to return is: ', profilesToReturn);
  console.log('posts and comments to iterate through: ', postsToReturn);
  console.log('i will iterate this number of times: ', postsToReturn.length);
  for (let i = 0; i < postsToReturn.length; i += 1) {
    console.log('For i of ', i, ' will iterate ', postsToReturn[i].comments.length, ' times');
    for (let j = 0; j < postsToReturn[i].comments.length; j += 1) {
      // const index = profilesToReturn.userId.indexOf(postsToReturn[i][j].user_id);
      const idToFind = postsToReturn[i].comments[j].user_id;
      const index = profilesToReturn.map((profile) => (profile.user_id)).indexOf(idToFind);
      const firstName = profilesToReturn[index].first_name;
      const lastName = profilesToReturn[index].last_name;
      console.log(firstName, lastName);
      postsToReturn[i].comments[j].name = `${firstName} ${lastName}`;
      // console.log('just assigned sally at postsToReturn[i].comments[j] of
      // ', postsToReturn[i].comments[j]);
    }
  }

  console.log('posts inc profiles ToReturn is ', postsToReturn);
  return postsToReturn;
};

// get posts to display and their associated comments
const getUserPosts = async (userId) => {
  // get posts
  const userPosts = await database.sendGetRequest('http://localhost:8080/post/', { id: userId });

  // get comments
  const postsArray = await getPostsComments(userPosts);

  // get / attach the names to each comment
  console.log('about to hop into getNamesFromDB with postsArray of: ', postsArray);
  const postsArrayWithNames = await getNamesFromDB(postsArray);

  return postsArrayWithNames;
};

function ProfilePage(props) {
  // dummy profile to help implement component frontend with right schema
  // define states
  const [userProfile, setUserProfile] = useState({ biography: '', username: 'Stacy Shapiro' });
  const [userPosts, setUserPosts] = useState([]);

  useEffect(async () => {
    // extract id from props
    console.log('props is: ', props);
    const { userId } = props.state;

    const dummyId = 9;
    console.log(userId);

    // call backend for content linked to userId
    const postsToSet = await getUserPosts(dummyId);
    const profileToSet = await getProfile(dummyId);

    // update state
    setUserPosts(postsToSet);
    setUserProfile(profileToSet);
  }, []);

  useEffect(async () => {
    console.log('state updated, userPosts is now: ', userPosts);
  }, [userPosts]);

  return (
    <div className="App">
      <div id="cover_space">
        <img id="user_profile_pic" src="Stacy meditating.jpg" alt="" />
        <div id="main_title">
          {userProfile.username}
          &apos;s FaceTok Page
        </div>
      </div>
      <div id="nav_button_container">
        <div className="nav_button">Friends</div>
        <div className="nav_button">Photos</div>
        <div className="nav_button">Groups</div>
        <div className="nav_button">Update bio</div>
        <div className="nav_button">Settings</div>
      </div>
      <div id="main_content_container">
        <div id="key_bio_info">
          {userProfile.biography}
        </div>
        <div id="post_container">
          {userPosts.map((post) => (
            <div className="wall_post">
              <img className="wall_post_pic" src={post.photourl} alt="" />
              <p />
              <div className="post_caption">
                {post.caption}
              </div>
              <div className="post_content_container">
                { post.comments.map((comment) => (
                  <div>
                    <p />
                    <b className="post_content_name">{comment.name}</b>
                    <div>
                      {comment.comment_txt}
                    </div>
                  </div>
                )) }
                <p />
                <div className="reply_container">
                  <div className="post_reply_textbox"> Type your reply here...</div>
                  <div className="post_reply_button">Reply!</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
