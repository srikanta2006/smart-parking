import emailjs from "emailjs-com";

const sendEmail = async (recipientEmail, qrImageUrl) => {
  try {
    // Validate email before sending
    if (!recipientEmail || !recipientEmail.trim() || !recipientEmail.includes('@')) {
      console.error("❌ Invalid email address:", recipientEmail);
      return false;
    }

    console.log("📧 Sending email to:", recipientEmail);
    
    // Include all possible parameter names that EmailJS might expect
    // This maximizes our chances of success regardless of template configuration
    const templateParams = {
      // Standard EmailJS parameters
      to_email: recipientEmail,
      reply_to: recipientEmail,
      from_name: "Smart Parking System",
      to_name: recipientEmail.split('@')[0],
      
      // For templates that use different parameter names
      email: recipientEmail,
      recipient: recipientEmail,
      user_email: recipientEmail,
      
      // Content parameters
      subject: "Your Parking Reservation Confirmation",
      qr_code: qrImageUrl,
      message: "Your parking spot has been reserved successfully. Please show the attached QR code when you arrive at the parking facility.",
      reservation_date: new Date().toLocaleString(),
      confirmation_number: `PK-${Math.floor(Math.random() * 1000000)}`
    };

    console.log("📧 Sending with parameters:", templateParams);
    
    const response = await emailjs.send(
      "service_8j0fylh",     // Service ID
      "template_vokazmj",    // Template ID 
      templateParams,
      "FFWA8ssS0SKB9ZRQl"    // User ID (public key)
    );

    console.log("📧 Email Sent Response:", response);
    return response.status === 200;
  } catch (error) {
    console.error("❌ Email Sending Error:", error);
    if (error.text) {
      console.error("❌ Error details:", error.text);
    }
    return false;
  }
};

export default sendEmail;