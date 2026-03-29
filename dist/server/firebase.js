import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || "./agent-firebase-service.json", "utf8"));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
admin.firestore().settings({
    ignoreUndefinedProperties: true,
});
export default admin;
//# sourceMappingURL=firebase.js.map