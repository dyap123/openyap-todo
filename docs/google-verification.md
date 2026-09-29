# Google OAuth verification for OpenYap Todo

Production project: `openyap-todo`, project number `121122715175`. Never configure this application in Command Center or the legacy shared project.

The app currently requests `https://www.googleapis.com/auth/calendar.events.readonly` separately from Firebase Google sign-in (basic identity scopes). It reads the primary calendar's events to display details and meeting links. Invite creation hands off to Google's native event composer; no Calendar write scope is requested. A switch to write scopes requires a separate implementation and verification review.

Current public app: https://dyap123.github.io/openyap-todo/
Privacy page after release: https://dyap123.github.io/openyap-todo/privacy.html
OAuth client: `121122715175-qsbbcmltuuh2hfkea8m4c4gn46h35kfs.apps.googleusercontent.com`.

## Administrator steps still required

1. Confirm the public production domain and support/developer email addresses with the owner. Do not invent a support address. Google requires ownership verification of authorized domains; select an owner-controlled domain if the current GitHub Pages hostname cannot meet that requirement.
2. Publish an accessible homepage that describes this app and links to the privacy policy. Review the policy against actual operations and supply the confirmed support contact. Match the homepage and privacy URLs in Google Auth Platform Branding for project `openyap-todo`.
3. Verify the authorized domain in Google Search Console using a project owner/editor account. Ensure Firebase authorized domains and OAuth origins/redirects match the deployed app. Keep the existing Firebase auth handler available.
4. Declare the read-only events scope under Data Access. Suggested justification: “OpenYap Todo displays the signed-in user's primary Google Calendar events alongside their tasks. Event details show descriptions, meeting links, dates and attendees. Availability-only access cannot provide those details. Events and access tokens remain in page memory; the app does not write to Calendar.”
5. Record the real English-language sign-in and consent flow with a test account: app name and OAuth client ID visible, Connect Calendar, month view, event details, meeting links and Disconnect. Use synthetic calendar content. Host the demonstration as an unlisted video and provide its link to Google. Do not record passwords, tokens or real private event content.
6. Run branding verification, publish approved branding, then submit sensitive-scope verification in the Verification Center. Respond to Google's follow-up messages. After approval, test the production consent experience with a fresh account.

Changing audience to production alone does not remove the unverified-app warning. This repository cannot bypass or certify Google's verification. There is no claim that verification has been submitted or approved.

Official guidance: [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) and [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
