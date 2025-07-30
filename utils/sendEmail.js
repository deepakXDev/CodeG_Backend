const nodeMailer=require('nodemailer');


const getSmtpAccounts = () => [
    {
        host: process.env.SMTP_HOST, 
        service: process.env.SMTP_SERVICE,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD
      },

    //   {
    //     host: process.env.SMTP1_HOST, 
    //     service: process.env.SMTP1_SERVICE,
    //     port: process.env.SMTP1_PORT,
    //     user: process.env.SMTP1_MAIL,
    //     pass: process.env.SMTP1_PASSWORD
    //   },

//   {
//         host: process.env.SMTP2_HOST,
//         service: process.env.SMTP2_SERVICE,
//         port: process.env.SMTP2_PORT,
//         user: process.env.SMTP2_MAIL,
//         pass: process.env.SMTP2_PASSWORD,
//     },
//     {
//         host: process.env.SMTP3_HOST,
//         service: process.env.SMTP3_SERVICE,
//         port: process.env.SMTP3_PORT,
//         user: process.env.SMTP3_MAIL,
//         pass: process.env.SMTP3_PASSWORD,
//     },
    ];

// Email counter and index tracker
let emailCount = 0;
let currentIndex = 0;


exports.sendEmail = async ({ to, subject, message }) => {
    try {

        const smtpAccounts = getSmtpAccounts(); 

        // ⏩ Rotate account after every 100 emails
        if (emailCount > 0 && emailCount % 100 === 0) {
            currentIndex = (currentIndex + 1) % smtpAccounts.length;
            console.log(`🔁 Switching to SMTP Account #${currentIndex + 1}`);
        }

        const account = smtpAccounts[currentIndex];


        // 1️⃣ Setup transporter with current SMTP credentials
        const transporter = nodeMailer.createTransport({
            host: account.host,
            service: account.service,
            port: account.port,
            secure: account.port === "465", // true for 465, false for 587
            auth: {
                user: account.user,
                pass: account.pass,
            },
        });

        // 2️⃣ Define email details
        const mailOptions = {
            from: {
                name: "CodeG",
                address: account.user,
            },
            to,
            subject,
            html: message,
        };

        // 3️⃣ Send email
        await transporter.sendMail(mailOptions);
        emailCount++;

        console.log(`📩 Email #${emailCount} sent to: ${to} using account #${currentIndex + 1}`);
    } catch (error) {
        console.error(`❌ Error sending email to ${to || "Unknown Email"}:`, error.message);
        throw new Error(`Email could not be sent to ${to}`);
    }
};
