package lib

import (
	"bytes"
	"fmt"
	"html/template"
	"net/smtp"
	"os"
)

type EmailService struct {
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	FromEmail    string
}

type VerificationEmailData struct {
	FirstName        string
	VerificationCode string
	BaseURL          string
}

type WelcomeEmailData struct {
	FirstName string
	BaseURL   string
}

type PasswordResetEmailData struct {
	FirstName         string
	TemporaryPassword string
}

/**************************************************************************************
* Creates a new email service with SMTP configuration from the environment variables.
* 
* Status: ✅
**************************************************************************************/

func NewEmailService() *EmailService {
	return &EmailService{
		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPPort:     os.Getenv("SMTP_PORT"),
		SMTPUsername: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		FromEmail:    os.Getenv("FROM_EMAIL"),
	}
}

/**************************************************************************************
* SendVerificationEmail sends a verification email with the verification code.
* 
* Status: ✅
**************************************************************************************/

func (es *EmailService) SendVerificationEmail(toEmail, firstName, verificationCode string) error {
	// Validate SMTP configuration
	if es.SMTPHost == "" || es.SMTPPort == "" || es.SMTPUsername == "" || es.SMTPPassword == "" {
		return fmt.Errorf("SMTP configuration is incomplete. Please check your environment variables")
	}

	// Parse template
	tmpl, err := template.ParseFiles("templates/verification_email.html")
    
	if err != nil {
		return fmt.Errorf("failed to parse verification email template: %w", err)
	}

	// Execute template
	var body bytes.Buffer
	data := VerificationEmailData{
		FirstName:        firstName,
		VerificationCode: verificationCode,
		BaseURL:          os.Getenv("BASE_URL") + "/auth/verify",
	}
	
	err = tmpl.Execute(&body, data)
	if err != nil {
		return fmt.Errorf("failed to execute verification email template: %w", err)
	}

	subject := "Verify Your Account"
	message := fmt.Sprintf("To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n"+
		"%s", toEmail, subject, body.String())

	// SMTP authentication
	auth := smtp.PlainAuth("", es.SMTPUsername, es.SMTPPassword, es.SMTPHost)

	// Send email
	addr := fmt.Sprintf("%s:%s", es.SMTPHost, es.SMTPPort)
	err = smtp.SendMail(addr, auth, es.FromEmail, []string{toEmail}, []byte(message))
	if err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	return nil
}

/**************************************************************************************
* SendWelcomeEmail sends a welcome email after successful verification.
* 
* Status: ✅
**************************************************************************************/
func (es *EmailService) SendWelcomeEmail(toEmail, firstName string) error {
	// Parse template
	tmpl, err := template.ParseFiles("templates/welcome_email.html")
	if err != nil {
		return fmt.Errorf("failed to parse welcome email template: %w", err)
	}

	// Execute template
	var body bytes.Buffer
	data := WelcomeEmailData{
		FirstName: firstName,
		BaseURL:   os.Getenv("BASE_URL"),
	}
	
	err = tmpl.Execute(&body, data)
	if err != nil {
		return fmt.Errorf("failed to execute welcome email template: %w", err)
	}

	subject := "Welcome!"
	message := fmt.Sprintf("To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n"+
		"%s", toEmail, subject, body.String())

	auth := smtp.PlainAuth("", es.SMTPUsername, es.SMTPPassword, es.SMTPHost)
	addr := fmt.Sprintf("%s:%s", es.SMTPHost, es.SMTPPort)
	
	return smtp.SendMail(addr, auth, es.FromEmail, []string{toEmail}, []byte(message))
}

func (es *EmailService) SendPasswordResetEmail(toEmail, firstName, temporaryPassword string) error {
	// Parse template
	tmpl, err := template.ParseFiles("templates/password_reset_email.html")
	if err != nil {
		return fmt.Errorf("failed to parse password reset email template: %w", err)
	}

	// Execute template
	var body bytes.Buffer
	data := PasswordResetEmailData{
		FirstName:         firstName,
		TemporaryPassword: temporaryPassword,
	}
	
	err = tmpl.Execute(&body, data)
	if err != nil {
		return fmt.Errorf("failed to execute password reset email template: %w", err)
	}

	subject := "Password Reset"
	message := fmt.Sprintf("To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"\r\n"+
		"%s", toEmail, subject, body.String())

	auth := smtp.PlainAuth("", es.SMTPUsername, es.SMTPPassword, es.SMTPHost)
	addr := fmt.Sprintf("%s:%s", es.SMTPHost, es.SMTPPort)
	
	return smtp.SendMail(addr, auth, es.FromEmail, []string{toEmail}, []byte(message))
}
