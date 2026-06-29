"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../config/logger");
class EmailService {
    async sendEmail(to, toName, subject, htmlBody) {
        const response = await fetch("https://api.zeptomail.in/v1.1/email", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Zoho-enczapikey ${env_1.env.zeptomailApiKey}`,
            },
            body: JSON.stringify({
                from: { address: env_1.env.zeptomailFromEmail },
                to: [{ email_address: { address: to, name: toName } }],
                subject,
                htmlbody: htmlBody,
            })
        });
        if (!response.ok) {
            const errorBody = await response.text();
            logger_1.logger.error(`Zeptomail send failed: ${response.status} ${errorBody}`);
            throw new Error(`Email send failed: ${response.status}`);
        }
        logger_1.logger.info(`Email sent to ${to}: ${subject}`);
    }
}
exports.EmailService = EmailService;
exports.emailService = new EmailService();
//# sourceMappingURL=email.service.js.map