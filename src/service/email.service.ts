import { env } from "../config/env"
import { logger } from "../config/logger"

export class EmailService {
    async sendEmail(
        to : string,
        toName : string,
        subject : string,
        htmlBody : string
    ): Promise<void> {
        const response = await fetch("https://api.zeptomail.in/v1.1/email",{
            method: "POST",
            headers: {
                "Accept" : "application/json",
                "Content-Type" : "application/json",
                "Authorization" : `Zoho-enczapikey ${env.zeptomailApiKey}`,
            },
            body: JSON.stringify({
                from: {address: env.zeptomailFromEmail},
                to: [{ email_address : {address: to, name: toName}}],
                subject,
                htmlbody: htmlBody,
            })
        })

        if (!response.ok) {
            const errorBody = await response.text()
            logger.error(`Zeptomail send failed: ${response.status} ${errorBody}`)
            throw new Error(`Email send failed: ${response.status}`)
        }
        logger.info(`Email sent to ${to}: ${subject}`)
    }
}

export const emailService = new EmailService()
