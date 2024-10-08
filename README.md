# Deployment REST service utility

This simple utility manages the deployment by calling deployment scripts when it receives `push` events from GitHub.

## Usage

The utility accepts the web hooks request from GitHub on the route `/handle`. [See more from the official documentation.](!https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks)

In order to configure how the utility responds to push events for the branches, you need to create `.env` file. You can take `.env.example` as a template.

There can be different target for the deployment (DEV, PROD etc.) Each target represent a different version of the software loaded from the repository. They are associated with a particular branch and particular path to the script file (`bash` as an example), that pulls the code and initiate the deployment on the server.

For each target, there should be one `<target>_BRANCH_NAME` that specifies the ref id from the repository to which it subscribed and `<target>_SCRIPT_PATH` that specifies the script, which is supposed to be run when the `push` event occurred.

You can specify the *secret* string to validate the hook delivery. For this, create in the root `secret-github` file (without file extension) and place inside the secret string.
