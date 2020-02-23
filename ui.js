$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allArticles = $(".articles-container");
  const $allStoriesList = $("#all-articles-list");
  const $favoritedStories = $("#favorited-articles");
  const $filteredArticles = $("#filtered-articles");
  const $ownStories = $("#my-articles");
  const $submitForm = $("#submit-form");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navLinks = $(".main-nav-links");
  const $navSubmit = $("#nav-submit");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    if (currentUser !== undefined){
      syncCurrentUserToLocalStorage();
      loginAndSubmitForm();
    }
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

    /**
   * Event Handler for Submitting Story
   */

  $submitForm.on("submit", async function(event) {
    event.preventDefault();
    const $storyAuthor = $("input#author").val();
    const $storyTitle = $("input#title").val();
    const $storyURL = $("input#url").val();
    const hostName = getHostName($storyURL);
    const username = currentUser.username;
    const createdUserStory = await storyList.addStory(currentUser, {
      author: $storyAuthor,
      title: $storyTitle,
      url: $storyURL
    })
    const $newArticle = $(`<li id="${createdUserStory.storyId}">
          <span class="star">
            <i class="far fa-star"></i>
          </span>
        <a class="article-link" href="${$storyURL}" target="a_blank">
          <strong>${$storyTitle}</strong>
        </a>
        <small class="article-author">by ${$storyAuthor}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${username}</small>
      </li>
    `);

    $allStoriesList.prepend($newArticle);

    $submitForm.slideUp("slow");
    $submitForm.trigger("reset");
  })

      /**
   * Event Handler for Favoriting Story
   */
  $allArticles.on("click", "i.fa-star", function(event) {
    if (currentUser){
      const articleId = event.target.parentElement.parentElement.id;  
      if (isFavorited(articleId)) {
        event.target.className = "far fa-star";
        currentUser.removeFavorite(articleId);
      }else {
        event.target.className = "fas fa-star";
        currentUser.addFavorite(articleId);
      }    
    }
  })

    /**
   * Event Handler for Navigation to Submit Form
   */

  $navSubmit.on("click", function() {
    if (currentUser) {
      hideElements();
      $allStoriesList.show();
      $submitForm.slideToggle();
    }
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });
  
  /**
   * Event handler for Navigation to Favorites
   */

  $navLinks.on("click", "#nav-favorites", function() {
    hideElements();
    if (currentUser) {
      generateFavStories();
      $favoritedStories.show();
    }
  });

  /**
   * Event handler for Navigation to My Stories
   */

  $navLinks.on("click", "#nav-my-stories", function() {
    hideElements();
    if (currentUser) {
      generateMyStories();
      $ownStories.show();
    }
  });

/**
  * Event handler to delete stories(for user who created it)
  */

  $ownStories.on("click", "i.fa-trash-alt", function(event) {
    const idToDelete = event.target.parentElement.parentElement.id
    
    $(`#my-articles #${idToDelete}`).remove();
    storyList.removeStory(currentUser, idToDelete)
    
    currentUser.ownStories = currentUser.ownStories.filter(value => {
      return value.storyId !== idToDelete
    })

    currentUser.favorites = currentUser.favorites.filter(value => {
      return value.storyId !== idToDelete
    })
  });

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // update and show the stories
    generateStories();
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }

  }

  /**
   * A rendering function to create the favorites list
   */

  function generateFavStories() {
    // empty out the list by default
    $favoritedStories.empty();

    // if user has no favorites
    if (currentUser.favorites.length === 0) {
      $favoritedStories.append("<h5>No favorites added!</h5>");
    } else {
      for (let favorite of currentUser.favorites) {
        let favoriteHTML = generateStoryHTML(favorite);
        $favoritedStories.append(favoriteHTML);
      }
    }
  }

  /**
   * A rendering function to create a list of the user's stories
   */

  function generateMyStories() {
    // empty out the list by default
    $ownStories.empty();
    // if user has no stories
    if (currentUser.ownStories.length === 0) {
      $ownStories.append("<h5>No stories here!</h5>");
    } else {
      for (let story of currentUser.ownStories) {
        const storyHTML = generateStoryHTML(story, true);
        $ownStories.append(storyHTML);
      }
    }
    $ownStories.show();
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story, isOwnStory) {
    const hostName = getHostName(story.url);
    // trash can icon to delete own stories
    const trashCanIcon = isOwnStory
      ? `<span class="trash-can">
          <i class="fas fa-trash-alt"></i>
        </span>`
      : "";
    
    // render story markup
    if (currentUser){
      const starType = isFavorited(story.storyId) ? "fas" : "far";
      const storyMarkup = $(`
        <li id="${story.storyId}">
          ${trashCanIcon}
          <span class="star">
            <i class="${starType} fa-star"></i>
          </span>
          <a class="article-link" href="${story.url}" target="a_blank">
            <strong>${story.title}</strong>
          </a>
          <small class="article-author">by ${story.author}</small>
          <small class="article-hostname ${hostName}">(${hostName})</small>
          <small class="article-username">posted by ${story.username}</small>
        </li>
      `);
      return storyMarkup;
    }else {
      const storyMarkup = $(`
          <li id="${story.storyId}">
            <a class="article-link" href="${story.url}" target="a_blank">
              <strong>${story.title}</strong>
            </a>
            <small class="article-author">by ${story.author}</small>
            <small class="article-hostname ${hostName}">(${hostName})</small>
            <small class="article-username">posted by ${story.username}</small>
          </li>
        `);
        return storyMarkup;
      }
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $favoritedStories
    ];
    elementsArr.forEach($elem => $elem.hide());
    if (!currentUser) {
      $navLinks.hide();
    }
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $navLinks.show();
  }

  function isFavorited(storyId) {
    if (currentUser) {
      return currentUser.favorites.some(value => {
        return storyId === value.storyId;
      })
    }
  }

  /* simple function to pull the hostname from a URL */
  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
