const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_PREFIX = '\x1b[36m[Cloudflare Wizard]\x1b[0m';
const ERROR_PREFIX = '\x1b[31m[ERROR]\x1b[0m';
const SUCCESS_PREFIX = '\x1b[32m[SUCCESS]\x1b[0m';

console.log(`${LOG_PREFIX} Starting automated setup...`);

// Helper to run commands
function run(command, cwd = process.cwd()) {
    try {
        return execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        return null; // Return null on failure
    }
}

// Helper to run interactive commands (like login)
function runInteractive(command, args, cwd = process.cwd()) {
    console.log(`${LOG_PREFIX} Running: ${command} ${args.join(' ')}`);
    console.log(`${LOG_PREFIX} ⚠️  If a browser opens, please click 'Allow' to log in.`);
    const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
    return result.status === 0;
}

const MIGRATION_DIR = path.join(__dirname, 'cloudflare_migration');
const TOML_PATH = path.join(MIGRATION_DIR, 'wrangler.toml');

async function main() {
    // 1. Check Login
    console.log(`${LOG_PREFIX} Checking Cloudflare authentication...`);
    let whoami = run('npx wrangler whoami', MIGRATION_DIR);

    if (!whoami || whoami.includes('You are not authenticated')) {
        console.log(`${LOG_PREFIX} 🔒 You need to login. Opening browser...`);
        const loggedIn = runInteractive('npx', ['wrangler', 'login'], MIGRATION_DIR);
        if (!loggedIn) {
            console.error(`${ERROR_PREFIX} Login failed. Please try again.`);
            return;
        }
    } else {
        console.log(`${SUCCESS_PREFIX} Already logged in.`);
    }

    // 2. Create D1 Database
    console.log(`${LOG_PREFIX} 📦 Creating/Checking D1 Database (forto-products)...`);
    let d1Output = run('npx wrangler d1 create forto-products', MIGRATION_DIR);
    let d1Id = '';

    if (!d1Output) {
        // Maybe it exists? Try to get info
        console.log(`${LOG_PREFIX} Database might exist, fetching info...`);
        const info = run('npx wrangler d1 info forto-products', MIGRATION_DIR);
        if (info) {
            const match = info.match(/database_id\s*\|\s*([a-f0-9-]+)/i);
            if (match) d1Id = match[1];
        }
    } else {
        const match = d1Output.match(/database_id\s*=\s*"([a-f0-9-]+)"/i);
        if (match) d1Id = match[1];
    }

    if (!d1Id) {
        // Fallback parsing strategy for 'create' output which might be different
        const matchV2 = d1Output ? d1Output.match(/id\s*:\s*([a-f0-9-]+)/) : null;
        if (matchV2) d1Id = matchV2[1];
    }

    if (!d1Id) {
        console.error(`${ERROR_PREFIX} Could not retrieve D1 Database ID.`);
        console.log("Output was:", d1Output);
        // Manual override prompt could go here, but we exit for safety
        // return; 
        console.log(`${LOG_PREFIX} Attempting to proceed without ID update (assuming manual setup)...`);
    } else {
        console.log(`${SUCCESS_PREFIX} Database ID found: ${d1Id}`);
    }

    // 3. Create KV Namespace
    console.log(`${LOG_PREFIX} 🗂️  Creating/Checking KV Namespace (PRODUCTS_KV)...`);
    let kvOutput = run('npx wrangler kv:namespace create PRODUCTS_KV', MIGRATION_DIR);
    let kvId = '';

    if (kvOutput && kvOutput.includes('id =')) {
        const match = kvOutput.match(/id\s*=\s*"([a-f0-9]+)"/);
        if (match) kvId = match[1];
    } else {
        // Try list if create failed (already exists?)
        const list = run('npx wrangler kv:namespace list', MIGRATION_DIR);
        if (list) {
            try {
                // The output is JSON-like but might have text around it. simpler regex
                const match = list.match(/"id":\s*"([a-f0-9]+)",\s*"title":\s*"PRODUCTS_KV"/); // This is approximate
                // wrangler list output is pure JSON usually?
                const jsonStart = list.indexOf('[');
                const jsonEnd = list.lastIndexOf(']') + 1;
                if (jsonStart > -1 && jsonEnd > -1) {
                    const namespaces = JSON.parse(list.substring(jsonStart, jsonEnd));
                    const ns = namespaces.find(n => n.title === 'PRODUCTS_KV' || n.title.includes('PRODUCTS_KV'));
                    if (ns) kvId = ns.id;
                }
            } catch (e) { }
        }
    }

    if (kvId) {
        console.log(`${SUCCESS_PREFIX} KV ID found: ${kvId}`);
    } else {
        console.log(`${LOG_PREFIX} Warning: Could not auto-detect KV ID. Proceeding...`);
    }

    // 4. Update wrangler.toml
    console.log(`${LOG_PREFIX} 📝 Updating configuration file...`);
    let toml = fs.readFileSync(TOML_PATH, 'utf8');

    if (d1Id) {
        toml = toml.replace(/database_id = ".*"/, `database_id = "${d1Id}"`);
    }
    if (kvId) {
        toml = toml.replace(/id = ".*"/, `id = "${kvId}"`); // CAREFUL: Matches KV id
    }

    fs.writeFileSync(TOML_PATH, toml);
    console.log(`${SUCCESS_PREFIX} Configuration saved.`);

    // 5. Initialize Schema
    if (d1Id) {
        console.log(`${LOG_PREFIX} 🏗️  Applying Database Schema...`);
        run(`npx wrangler d1 execute forto-products --file=schema.sql --remote`, MIGRATION_DIR);
    }

    // 6. Deploy
    console.log(`${LOG_PREFIX} 🚀 Deploying to Cloudflare Network...`);
    const deployOutput = run('npx wrangler deploy', MIGRATION_DIR);
    console.log(deployOutput);

    // 7. Extract URL
    const urlMatch = deployOutput ? deployOutput.match(/https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.workers\.dev/) : null;
    if (urlMatch) {
        const workerUrl = urlMatch[0];
        console.log(`${SUCCESS_PREFIX} Worker Deployed at: ${workerUrl}`);

        // 8. Update Client Code
        console.log(`${LOG_PREFIX} 🔗 Linking website to Worker...`);
        const jsPath = path.join(__dirname, 'js', 'cloud-products.js');
        let jsCode = fs.readFileSync(jsPath, 'utf8');
        jsCode = jsCode.replace(/const CF_WORKER_URL = ".*";/, `const CF_WORKER_URL = "${workerUrl}";`);
        fs.writeFileSync(jsPath, jsCode);

        console.log(`${SUCCESS_PREFIX} 🔗 Website Linked Successfully!`);
        console.log(`${SUCCESS_PREFIX} Migration Complete.`);
    } else {
        console.error(`${ERROR_PREFIX} Deployment finished but URL could not be detected.`);
    }
}

main();
