import fs from 'node:fs';
import express from 'express';
import dotenv from 'dotenv'
import { exec } from 'node:child_process';

import { Webhooks } from "@octokit/webhooks";
import winston from 'winston'; 
import 'winston-daily-rotate-file'
import { areSetsEqual } from './utils.js';

dotenv.config();
const { combine, timestamp, json } = winston.format;

const logger = winston.createLogger({
    level: 'info',
    format: combine(timestamp(), json()),
    transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
            dirname: 'logs',
            filename: 'deploy-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '20d'
        })
    ]
})

const PATH_SUFFIX = '_SCRIPT_PATH';
const BRANCH_SUFFIX = '_BRANCH_NAME';

const envKeys = Object.keys(process.env);

const depScriptPathTargets = envKeys
    .filter(k => k.endsWith(PATH_SUFFIX))
    .map(k => k.slice(0, -PATH_SUFFIX.length));
const branchNameTargets = envKeys
    .filter(k => k.endsWith(BRANCH_SUFFIX))
    .map(k => k.slice(0, -BRANCH_SUFFIX.length));
    

const pathSet = new Set(depScriptPathTargets);
const branchSet = new Set(branchNameTargets);

if (!areSetsEqual(pathSet, branchSet)) {
    
    throw new Error(`Error in ENV file. The target names for the deployment paths and branch names have to be the same. \
        For each target in branch name, there should be the same target in script path, and vice versa. \
        <TARGET>_BRANCH_NAME <--> <TARGET>_SCRIPT_PATH`);
}

const branchPathStr = depScriptPathTargets.map(targetKey => {
    const path = process.env[targetKey + PATH_SUFFIX];
    const branchName = process.env[targetKey + BRANCH_SUFFIX];
    return `${branchName} --> ${path}`;
})
logger.info(`Listening for the updates in the following branches and calling the following deploy scripts: \
        ${branchPathStr.join('\n')}
    `)


const app = express();

const PORT = process.env.PORT || 30100;
let github_secret = null;

try {
    github_secret = fs.readFileSync(process.engv.SECRET_FILE || './secret-github', 'utf-8');
} catch (e) {
    logger.warn('The SECRET_FILE was not found. The secret will be ignored.')
}
const webhooks = github_secret && new Webhooks({
    secret: github_secret,
});

const branchToPath = depScriptPathTargets.reduce((acc, target) => {
    acc[process.env[target + BRANCH_SUFFIX]] = process.env[target + PATH_SUFFIX];
    return acc;
}, {})

// const branches = Object.keys(branchToPath);

app.use(express.text())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.post('/handler', async (req, res) => {
    

    
    const signature = req.headers['x-hub-signature-256']; 

    const event = req.headers['x-github-event'];
    const branch = req.body?.ref?.split('/').slice(-1)[0];
    const isValid = await webhooks?.verify(JSON.stringify(req.body), signature)
    
    if (github_secret && !isValid) {
        logger.error('The signature is not valid.');
        res.status(401).send('Unauthorized');
        return;
    }
    res.status(202).send('Accepted');
    if (event !== 'push') {
        return;
    }
    if(!branch) {
        logger.error(`Branch is undefined. REF: ${req.body.ref}`)
        return;
    }
    
    
    if (!branchToPath.hasOwnProperty(branch)) {
        logger.info(`PUSH event to branch: ${branch}. Skipped.`)
        return;
    }
    const target = branchNameTargets.find(target => process.env[target + BRANCH_SUFFIX] === branch)
    deployLog(target, branch);
    const deployScript = exec(branchToPath[branch], scriptCb);

    deployScript?.on('close', (code) => {
        logger.info(`The deploy script finished with code: ${code}`)
    })
});


app.listen(PORT, () => {
    logger.info(`The Deployment service has been successfully started. Listening on port ${PORT}.`);
    logger.info(`The deployment target is: ${process.env.TARGET}.`);
})

function scriptCb(error, stdout, stderr) {
    if (error) logger.error(`The deployment script has finished with error: ${error.code}`);
    logger.info(stdout, stderr);
}

function deployLog(target, branch) {
    logger.info(`Starting the deployment for ${target}. Pulling the code from branch ${branch}`);
}

process.on('exit', (code) => {
    logger.info(`Terminating the deployment service. Exit code: ${code}`)
});