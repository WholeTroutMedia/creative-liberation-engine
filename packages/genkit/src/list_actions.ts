import { ai } from './ai.js';
console.log("Registered actions:");
ai.registry.listActions().then(actions => {
    console.log(Object.keys(actions));
}).catch(err => {
    console.error("Error listing actions:", err);
});
