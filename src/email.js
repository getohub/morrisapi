import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
});

const verificationEmailHtmlTemplate = fs.readFileSync(path.resolve(__dirname, './emails/verificationEmail.html'), 'utf8');

export const sendVerificationEmail = (userId, email, subject) => {
    
    const verificationEmailHtml = verificationEmailHtmlTemplate.replace('{{id}}', userId);

    const mailOptions = {
        from: {
            name: 'Mail de confirmation',
            address: process.env.EMAIL_USER,
        },
        to: [email],
        subject: subject,
        text: 'Merci de vous être inscrit. Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :',
        html: verificationEmailHtml,
    };

    return transporter.sendMail(mailOptions);
};