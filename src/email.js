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
    try {
        const verificationEmailHtml = verificationEmailHtmlTemplate.replace(/\{\{id\}\}/g, userId);

        const mailOptions = {
            from: {
                name: 'Morris Game',
                address: process.env.EMAIL_USER,
            },
            to: [email],
            subject: subject,
            text: `Merci de vous être inscrit. Veuillez vérifier votre compte en cliquant sur ce lien : https://morris-teal.vercel.app/verifyEmail/${userId}`,
            html: verificationEmailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send verification email');
    }
};