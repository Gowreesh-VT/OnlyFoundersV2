import nodemailer from 'nodemailer';

// Create reusable SMTP transporter
export const createEmailTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER!,
            pass: process.env.SMTP_PASSWORD!,
        },
    });
};

// Send login credentials email
export async function sendLoginCredentials(
    to: string,
    fullName: string,
    email: string,
    password: string,
) {
    const transporter = createEmailTransporter();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: 'Inter', Arial, sans-serif;
            background-color: #050505;
            color: #FFFFFF;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: #121212;
            border: 1px solid #FFD700;
            padding: 40px;
        }
        .header {
            font-family: 'Playfair Display', serif;
            font-size: 32px;
            color: #FFD700;
            margin-bottom: 20px;
            text-align: center;
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo img {
            max-width: 180px;
            height: auto;
        }
        .subtitle {
            font-size: 16px;
            color: #A1A1AA;
            text-align: center;
            margin-bottom: 40px;
        }
        .credentials-box {
            background: #1A1A1A;
            border: 1px solid #FFD700;
            padding: 30px;
            margin: 30px 0;
        }
        .credential-row {
            margin: 15px 0;
        }
        .credential-label {
            color: #A1A1AA;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        .credential-value {
            color: #FFD700;
            font-size: 18px;
            font-family: 'JetBrains Mono', monospace;
            font-weight: bold;
        }
        .button {
            display: inline-block;
            background: #FFD700;
            color: #050505;
            padding: 15px 40px;
            text-decoration: none;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .warning {
            background: #2A1A0A;
            border-left: 3px solid #FFD700;
            padding: 15px;
            margin: 20px 0;
            color: #FFD700;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #262626;
            color: #A1A1AA;
            font-size: 12px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <img src="https://only-founders-omega.vercel.app/icons/icon-192x192.png" alt="OnlyFounders" />
        </div>
        <div class="header">ONLYFOUNDERS</div>
        
        <p>Dear ${fullName},</p>
        
        <p>Welcome to the OnlyFounders App! Your account has been created.</p>
        
        <div class="credentials-box">
            <div class="credential-row">
                <div class="credential-label">Login Email</div>
                <div class="credential-value">${email}</div>
            </div>
            <div class="credential-row">
                <div class="credential-label">Temporary Password</div>
                <div class="credential-value">${password}</div>
            </div>
        </div>
        
        <center>
            <a href="https://only-founders-omega.vercel.app/" class="button">
                LOGIN NOW
            </a>
        </center>
        
        <div class="footer">
            © 2026 OnlyFounders - The Exclusive Network<br>
            This is an automated email. Please do not reply.
        </div>
    </div>
</body>
</html>
    `.trim();

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to,
        subject: 'OnlyFounders Event - Your Login Credentials',
        html: htmlContent,
        text: `
Dear ${fullName},

Welcome to OnlyFounders App!

Your Login Credentials:
-----------------------
Email: ${email}
Password: ${password}

Login here: https://only-founders-omega.vercel.app/


© 2026 OnlyFounders
        `.trim(),
    };

    return await transporter.sendMail(mailOptions);
}

// Send bulk credentials (for CSV upload)
export async function sendBulkCredentials(
    recipients: Array<{
        email: string;
        fullName: string;
        password: string;
        entityId?: string;
    }>
) {
    const results = {
        success: [] as string[],
        failed: [] as { email: string; error: string }[],
    };

    for (const recipient of recipients) {
        try {
            await sendLoginCredentials(
                recipient.email,
                recipient.fullName,
                recipient.email,
                recipient.password
            );
            results.success.push(recipient.email);
            // Rate limit to avoid SMTP throttling
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
            results.failed.push({
                email: recipient.email,
                error: error.message,
            });
        }
    }

    return results;
}

// Generate cryptographically secure random password
export function generateSecurePassword(length: number = 12): string {
    const crypto = require('crypto');
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '@#$%&*';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    
    // Helper function to get cryptographically secure random index
    const secureRandomIndex = (max: number): number => {
        const randomBytes = crypto.randomBytes(4);
        const randomValue = randomBytes.readUInt32BE(0);
        return randomValue % max;
    };
    
    let password = '';
    // Ensure at least one of each type
    password += uppercase[secureRandomIndex(uppercase.length)];
    password += lowercase[secureRandomIndex(lowercase.length)];
    password += numbers[secureRandomIndex(numbers.length)];
    password += symbols[secureRandomIndex(symbols.length)];
    
    // Fill the rest
    for (let i = password.length; i < length; i++) {
        password += allChars[secureRandomIndex(allChars.length)];
    }
    
    // Shuffle the password using Fisher-Yates with secure random
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = secureRandomIndex(i + 1);
        [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    
    return passwordArray.join('');
}
