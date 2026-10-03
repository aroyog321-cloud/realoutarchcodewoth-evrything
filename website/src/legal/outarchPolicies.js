// OUTARCH's legal and privacy policies, as data.
//
// One source for every surface: the desktop app renders these in Settings >
// Legal & privacy and on the first-launch agreement, and the website renders
// the same text at /legal. scripts/sync-legal.cjs copies this file to
// website/src/legal/outarchPolicies.js; a test fails if the copies differ.
//
// Every statement here describes how the code actually behaves. If a feature
// changes what it collects, sends or stores, change the matching text here in
// the same commit and bump LEGAL_VERSION when the change affects what a person
// agreed to (the desktop app asks again when the version changes).
//
// Words in braces are filled in by the page that shows them:
//   {operator}      the business that runs OUTARCH (or "OUTARCH" until it is set)
//   {contact}       the support email, or where to find it
//   {jurisdiction}  the law and courts named in the terms
//
// A section's blocks are paragraphs (strings) and lists (arrays of strings).
// This file holds no JSX so the desktop renderer and the website can both
// import it.

export const LEGAL_VERSION = "2026-09-23";
export const LEGAL_UPDATED = "23 September 2026";

// The documents a person agrees to before the desktop app starts. The privacy
// policy is a notice, not something to agree to, so it is linked, not ticked.
export const AGREEMENT_POLICY_IDS = Object.freeze(["terms", "eula"]);

const POLICY_LIST = [
  {
    id: "terms",
    path: "/terms",
    title: "Terms of service",
    summary: "The agreement between you and {operator} for the OUTARCH app, website and account.",
    sections: [
      {
        heading: "Who these terms are with",
        blocks: [
          "These terms are an agreement between you and {operator} (\"we\", \"us\"). They cover the OUTARCH desktop app, the OUTARCH website, your OUTARCH account, the phone companion and the VS Code bridge (together, \"OUTARCH\"). The End User Licence Agreement, the Acceptable Use Policy and the AI Services Terms are part of these terms. The Privacy Policy explains how we handle personal data.",
          "By creating an account, or by agreeing when the desktop app first starts, you accept these terms. If you do not agree, do not use OUTARCH."
        ]
      },
      {
        heading: "Your account",
        blocks: [
          "You need an account to use the desktop app. You sign in on the OUTARCH website with an email address and password, or with Google.",
          [
            "You must be at least 18 years old to create an account.",
            "Give accurate details and keep your sign-in details to yourself. You are responsible for what happens under your account.",
            "If you think someone else has used your account, contact {contact} promptly."
          ]
        ]
      },
      {
        heading: "Plans",
        blocks: [
          "OUTARCH has a Free plan and paid plans (Pro and Ultimate). What each plan includes is shown on the pricing page and in the app. Paid plans are prepaid for a fixed period and do not renew automatically.",
          "The terms for buying a paid plan online, including the payment provider and how payments are handled, are shown on the checkout page when online checkout is available. We may change plans and prices for future purchases; a period you have already paid for keeps the plan and price you bought."
        ]
      },
      {
        heading: "Your code and data",
        blocks: [
          "Your projects, source code, files, terminal output and project memory belong to you. We do not claim any ownership of them.",
          "OUTARCH runs on your computer. It sends parts of your data to other services only for the features you use, as the Privacy Policy and the AI & Developer Data notice describe, for example when you ask Mission AI a question."
        ]
      },
      {
        heading: "Intellectual property",
        blocks: [
          "OUTARCH, its software, design, name and logo belong to {operator} and its licensors and are protected by law. These terms do not give you any right to use the OUTARCH name or logo.",
          "Open-source components included in OUTARCH are licensed under their own licences, listed in Open-source licences. Nothing in these terms limits the rights those licences give you.",
          "If you send us feedback or suggestions, we may use them without owing you anything."
        ]
      },
      {
        heading: "AI features",
        blocks: [
          "Mission AI and the AI agents you run can be wrong, incomplete or unsafe. Review what they suggest before you rely on it or approve it. The AI Services Terms apply to every AI feature."
        ]
      },
      {
        heading: "Third-party services",
        blocks: [
          "OUTARCH can connect to services we do not run: AI providers you choose, Google sign-in, MCP clients, VS Code and the tools your terminals start. Your use of those services is governed by their own terms and privacy policies, and we are not responsible for them."
        ]
      },
      {
        heading: "Availability and changes",
        blocks: [
          "We work to keep the account service available but do not promise it will never be interrupted. If the account service cannot be reached, the desktop app keeps working for up to 72 hours on the last plan it confirmed.",
          "We may change, add or remove features. We will tell you in the app or on the website before a change takes away a feature of a plan you have already paid for."
        ]
      },
      {
        heading: "Suspension and termination",
        blocks: [
          "You can stop using OUTARCH at any time and ask us to delete your account (see Data Retention & Deletion).",
          "We may suspend or close an account, or refuse service, if it breaks these terms or the Acceptable Use Policy, if we must do so by law, or to protect OUTARCH, its users or others from harm. Where the law and the circumstances allow, we will tell you why and give you a chance to respond first.",
          "When an account closes, the app stops working for it. Data on your computer stays there; the Data Retention & Deletion policy says what happens to data we hold."
        ]
      },
      {
        heading: "Disclaimer",
        blocks: [
          "OUTARCH is provided \"as is\" and \"as available\". To the extent the law allows, we make no promise that it is free of errors, that it will meet your needs, or that it will not affect your projects, files or systems. Keep backups and use version control."
        ]
      },
      {
        heading: "Limitation of liability",
        blocks: [
          "To the extent the law allows, we are not liable for indirect, incidental, special or consequential losses, or for lost profits, revenue, data or goodwill. Our total liability for any claim about OUTARCH is limited to the amount you paid us for OUTARCH in the twelve months before the claim.",
          "Nothing in these terms limits liability that cannot be limited by law."
        ]
      },
      {
        heading: "Governing law",
        blocks: [
          "These terms are governed by the laws of {jurisdiction}, and its courts have jurisdiction over disputes about them, subject to any rights you have under the law of the place where you live."
        ]
      },
      {
        heading: "Changes to these terms",
        blocks: [
          "If we change these terms we will update this page and the date above. If a change is significant, the desktop app asks you to agree again before you continue."
        ]
      },
      {
        heading: "Contact",
        blocks: ["For anything about these terms, contact {contact}."]
      }
    ]
  },
  {
    id: "eula",
    path: "/eula",
    title: "End user licence agreement",
    summary: "What you may and may not do with the OUTARCH software you install.",
    sections: [
      {
        heading: "The software",
        blocks: [
          "This licence covers the OUTARCH software you install: the Windows desktop app and its engine, the terminal interface (the outarch command), the OUTARCH Bridge extension for VS Code, the phone companion page the desktop app serves, and updates to them (the \"Software\"). It forms part of the Terms of service."
        ]
      },
      {
        heading: "Your licence",
        blocks: [
          "{operator} gives you a personal, non-exclusive, non-transferable, revocable licence to install and use the Software on computers and phones you own or control, for your own development work or your organisation's, within the limits of your plan."
        ]
      },
      {
        heading: "What you may not do",
        blocks: [
          [
            "Sell, rent, sublicense or distribute the Software, except as an open-source licence for a component allows.",
            "Remove, disable or get around plan checks, sign-in, update signature checks or other protections.",
            "Reverse engineer or decompile the Software, except where the law allows it despite this restriction.",
            "Remove copyright, licence or trademark notices.",
            "Use the Software in breach of the Acceptable Use Policy."
          ]
        ]
      },
      {
        heading: "Updates",
        blocks: [
          "The desktop app looks for updates shortly after it starts and then every six hours. An update is installed only after its signature is checked against the OUTARCH release key, and on Windows only when you choose to install it. Some updates may be needed to keep using the account service."
        ]
      },
      {
        heading: "Open-source components",
        blocks: [
          "The Software includes open-source components under their own licences (see Open-source licences). Those licences apply to those components instead of this agreement where they differ."
        ]
      },
      {
        heading: "Ownership",
        blocks: [
          "The Software is licensed, not sold. {operator} and its licensors keep all rights in it that this licence does not expressly give you."
        ]
      },
      {
        heading: "Ending the licence",
        blocks: [
          "This licence ends when your account closes or if you break it. When it ends, stop using the Software and uninstall it. The sections on ownership, disclaimer and limitation of liability in the Terms of service continue to apply."
        ]
      }
    ]
  },
  {
    id: "privacy",
    path: "/privacy",
    title: "Privacy policy",
    summary: "What OUTARCH collects, why, where it goes and the choices you have.",
    sections: [
      {
        heading: "Who is responsible",
        blocks: [
          "{operator} runs OUTARCH and is responsible for the personal data described here. For any question about privacy, contact {contact}.",
          "This policy covers the OUTARCH website, the account service, the desktop app, the phone companion and the VS Code bridge. The AI & Developer Data notice and the Mobile companion notice give more detail on those parts."
        ]
      },
      {
        heading: "What stays on your computer",
        blocks: [
          "OUTARCH is built to run on your computer. These are stored there and are not sent to us:",
          [
            "Your projects, source code and files, and the terminals OUTARCH runs and their output.",
            "Project settings, workspace history and activity records, and project memory (arch_memory.md in your project folder).",
            "Your own AI provider API keys and other credentials, encrypted with Windows' data protection for your user account.",
            "Mission AI model choices, interface preferences, MCP gateway and phone pairing credentials, and local diagnostic records. Mission AI conversations are kept in memory and are cleared when the app closes."
          ],
          "Some of this can be sent to other services when you use a feature that needs it. The sections below and the AI & Developer Data notice say exactly when."
        ]
      },
      {
        heading: "What we collect and keep",
        blocks: [
          [
            "Account: your email address, and your name and profile picture if you sign in with Google and Google shares them.",
            "Plan: which plan you have, when it started and ends, and how many built-in Mission AI messages you used today.",
            "Mission AI usage records: for built-in models, a record of each message turn (the surface it came from, the number of model calls and the time). The content of your messages is not stored by us. These records are deleted after two days.",
            "Plan requests: if you ask for a plan from the app or website, the plan and any message you write.",
            "Sign-in and security records kept by our authentication provider, such as sign-in times and the IP address and browser used."
          ],
          "When online checkout is available, payment records (order reference, plan, amount, currency, status and payment method type) are kept as described on the checkout page. We do not receive card, UPI or bank account details."
        ]
      },
      {
        heading: "Why we use it",
        blocks: [
          [
            "To create and secure your account and sign you in to the app.",
            "To apply your plan's limits and count built-in Mission AI messages.",
            "To deliver app updates and answer your questions.",
            "To prevent abuse and to meet legal obligations."
          ],
          "We use your personal data only for these purposes. We do not sell it, and we do not use it for advertising."
        ]
      },
      {
        heading: "What the desktop app sends, and when",
        blocks: [
          [
            "Account service: when the app starts, when its window gets focus and about every five minutes, it asks our account service which plan your account has. The request carries your sign-in session, not your projects.",
            "Updates: shortly after it starts and then every six hours, the app asks our release service whether a newer version exists, and downloads it if you choose to.",
            "Mission AI with a built-in model: your message and the context described in the AI & Developer Data notice pass through our AI proxy to the model provider (Google Gemini or NVIDIA) and back. The proxy counts the message but does not store its content.",
            "Mission AI with your own API key: requests go from your computer directly to the provider you chose. We do not see them.",
            "Nothing else is sent to us. The app has no analytics, telemetry, advertising or crash-reporting service."
          ]
        ]
      },
      {
        heading: "Who processes data for us",
        blocks: [
          "The Third-party services page lists every service that receives personal data from OUTARCH, what it receives and why."
        ]
      },
      {
        heading: "Cookies and browser storage",
        blocks: [
          "The website does not use advertising or analytics trackers. The Cookie Policy lists what the website stores in your browser."
        ]
      },
      {
        heading: "How long we keep it",
        blocks: [
          "The Data Retention & Deletion policy says how long each kind of data is kept and how to delete it."
        ]
      },
      {
        heading: "Security",
        blocks: [
          "The Security page describes how OUTARCH protects your data and how to report a vulnerability. No system is perfectly secure, and we cannot promise that data will never be accessed without permission."
        ]
      },
      {
        heading: "Your rights and choices",
        blocks: [
          "Depending on the law that applies to you, including India's Digital Personal Data Protection Act, 2023, you can ask us for a summary of the personal data we hold about you, ask us to correct or complete it, ask us to delete it, and nominate someone to act for you. You can also withdraw consent where we rely on it, and you can raise a grievance with us.",
          "You can download a copy of your account data at any time from your account page on the OUTARCH website. To use your other rights, contact {contact} from the email address on your account. We may need to confirm it is you. If you are not satisfied with our response, you may be able to complain to the data protection authority where you live."
        ]
      },
      {
        heading: "Children",
        blocks: [
          "OUTARCH is not intended for anyone under 18, and we do not knowingly collect personal data from them. If you believe a child has created an account, contact {contact} and we will delete it."
        ]
      },
      {
        heading: "Where data is processed",
        blocks: [
          "Our account database and server functions are hosted by Supabase in Mumbai, India. AI providers you use, Google and our other service providers may process data in other countries under their own terms."
        ]
      },
      {
        heading: "Changes",
        blocks: [
          "If we change this policy we will update this page and the date above, and tell you in the app or by email if the change is significant."
        ]
      }
    ]
  },
  {
    id: "ai-data",
    path: "/ai-data",
    title: "AI & developer data",
    summary: "Exactly what Mission AI, agents, MCP clients, the VS Code bridge and project memory can read, send and do.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          "OUTARCH itself does not upload your code. Data leaves your computer when you use an AI feature (it goes to the AI provider behind the model you picked), when you connect a tool such as an MCP client (it goes to that tool), and for the account and update checks described in the Privacy Policy."
        ]
      },
      {
        heading: "What Mission AI can read",
        blocks: [
          "When you ask Mission AI something on the desktop, it can use these read-only tools without asking first. What they return is sent to the AI provider as part of the conversation:",
          [
            "A summary of the open project: its name and folder, the workers (terminals), their status, command, working folder and last printed line, saved recipes and what needs your attention.",
            "Recent terminal output of a worker: up to 120 recent lines, with colour codes removed and values that look like secrets replaced by [REDACTED].",
            "Project files: listing folders, reading text files and searching them. Files that hold secrets (such as .env files, private keys and credential files) are not read, and values that look like secrets are replaced by [REDACTED].",
            "The local addresses your workers are serving."
          ],
          "Redaction is pattern-based. It catches common secrets but cannot guarantee that every sensitive value is removed, so do not keep secrets in ordinary source files."
        ]
      },
      {
        heading: "What Mission AI can do, and approvals",
        blocks: [
          "Actions change something, so Mission AI shows each one to you, exactly as it will run, and waits for your approval:",
          [
            "Starting, stopping or restarting a worker, creating a worker, and saving or running a recipe.",
            "Typing text into one of your terminals.",
            "Running a command of its own. These run in a private terminal that only Mission AI uses, in your project folder, with your user account's permissions, and their output goes back to the AI provider."
          ],
          "If you choose \"Always allow here\" on an approval, Mission AI runs further actions in that conversation without asking. Use it only when you trust what the conversation is doing. Commands Mission AI runs can change or delete files and reach the network like any command you run yourself."
        ]
      },
      {
        heading: "AI agents in your terminals",
        blocks: [
          "Coding agents you start in OUTARCH terminals (for example Claude Code, Codex or Gemini CLI) are separate programs. They read files, run commands and send data to their providers under their own settings and terms. OUTARCH watches their terminals, tells you when one asks for permission and shows you what it is doing, but it does not control what they send."
        ]
      },
      {
        heading: "Built-in models and your own keys",
        blocks: [
          [
            "Built-in models: requests go through OUTARCH's AI proxy (a Supabase server function) to Google Gemini or NVIDIA. The proxy checks your plan, counts the message and passes the request on; it does not store your prompts or the answers.",
            "Your own API key: requests go from your computer straight to the provider you chose (for example OpenAI, Anthropic, Google, OpenRouter, NVIDIA and the others listed in the app). Your key is stored on your computer, encrypted by Windows, and is sent only to that provider."
          ],
          "Each AI provider handles what it receives under its own terms and privacy policy, including whether it keeps or trains on it. We do not control this and do not make promises about it. Read your provider's terms before you send it anything confidential."
        ]
      },
      {
        heading: "Phone questions",
        blocks: [
          "A paired phone that is allowed to ask Mission AI sends its question to your computer, encrypted. Your computer passes it to its Mission AI model with read-only tools only. Terminal output and files are included only if the phone was given the terminal-reading permission when it was paired."
        ]
      },
      {
        heading: "Project memory",
        blocks: [
          "Project memory keeps an arch_memory.md file in your project folder. OUTARCH asks before it creates the file. To write the project summary and change entries, it sends your README, project facts and summaries of recent Git changes (lock files and similar files excluded, secrets redacted) to the memory model, and it adds entries only; it never deletes them. The file is plain text in your project, so anything you commit or share with it goes with your repository."
        ]
      },
      {
        heading: "MCP gateway",
        blocks: [
          "The MCP gateway lets MCP clients (such as Claude Desktop) read OUTARCH's view of your workspace. It listens only on this computer (127.0.0.1), needs a token and grants only the scopes you choose. Terminal output needs its own scope. Changes an MCP client asks for wait in Needs You until you approve them, run once, and expire if left waiting.",
          "Anything an MCP client reads is then handled by that client and its AI provider under their terms."
        ]
      },
      {
        heading: "VS Code bridge",
        blocks: [
          "The OUTARCH Bridge extension connects VS Code to the desktop app over a local connection on this computer, after a one-time token handshake. It shares the project-relative path of the active file and the cursor position, diagnostic counts and up to 50 diagnostics, the Git branch and overall working-tree state, task results, and terminal names and states.",
          "Where VS Code shell integration is on, it also shares the commands run in VS Code terminals and what they print, so OUTARCH can show those terminals. OUTARCH hides commands and lines that look like secrets, keeps only the last 200 lines of each terminal in memory while the bridge is connected, and does not pass them to Mission AI or MCP clients.",
          "It does not send environment values or file contents. It can type into or close only terminals OUTARCH created, and only after your approval."
        ]
      },
      {
        heading: "Git data",
        blocks: [
          "OUTARCH reads Git information from your project folder on your computer (branch, changed files and, for project memory, recent diffs). Git data leaves your computer only in the cases above: in Mission AI tool results and project memory requests to the memory model. The branch and working-tree state the VS Code bridge shares stay on your computer."
        ]
      },
      {
        heading: "Credentials, logs and device information",
        blocks: [
          [
            "Credentials: your sign-in session, AI keys, MCP tokens and phone pairing keys are encrypted with Windows' data protection and stored in OUTARCH's data folder on your computer. They are never written to project files, never shown to the app's interface in full and never sent to us.",
            "Logs: OUTARCH keeps local diagnostic and recovery records on your computer. They are not sent anywhere.",
            "Device information: the app does not send us your device name, hardware details or files. Our account and update services see the IP address a request comes from, as any internet service does."
          ]
        ]
      },
      {
        heading: "AI output",
        blocks: [
          "AI output can be wrong, out of date, insecure or similar to other people's code. Check it before you use it. The AI Services Terms explain your responsibilities."
        ]
      }
    ]
  },
  {
    id: "ai-terms",
    path: "/ai-terms",
    title: "AI services terms",
    summary: "Rules for Mission AI, project memory's AI and any AI provider you connect.",
    sections: [
      {
        heading: "What these terms cover",
        blocks: [
          "These terms apply to Mission AI (on the desktop and from a paired phone), to project memory's use of AI, and to any AI provider you connect with your own API key. They are part of the Terms of service."
        ]
      },
      {
        heading: "AI output is not advice",
        blocks: [
          [
            "AI output is generated automatically. It can be wrong, incomplete, outdated, insecure or offensive, and it can describe things that are not true about your project.",
            "It is not professional, legal, security or financial advice.",
            "You are responsible for reviewing output, code and commands before you use, approve, run, commit or ship them."
          ]
        ]
      },
      {
        heading: "Approvals are your decision",
        blocks: [
          "OUTARCH shows actions to you before they run, unless you turn on \"Always allow here\" for a conversation. An action you approve, or allow in advance, runs with your user account's permissions, and you are responsible for its effects."
        ]
      },
      {
        heading: "Your input and output",
        blocks: [
          "As between you and us, you keep your rights in what you send to Mission AI and in the output you receive, to the extent the law and the AI provider's terms allow. We do not claim ownership of either. You must have the right to send whatever you send, including other people's code or personal data."
        ]
      },
      {
        heading: "AI providers",
        blocks: [
          "Built-in models are provided by Google (Gemini) and NVIDIA through OUTARCH's AI proxy. If you add your own API key, your use of that provider is between you and the provider, under its terms, and any charges it makes are yours. OUTARCH does not charge you for requests made with your own key.",
          "Providers decide how they keep and use the data they receive. Check their terms before you send confidential information."
        ]
      },
      {
        heading: "Limits and availability",
        blocks: [
          "Built-in Mission AI messages are limited by your plan. We may change which built-in models are offered, limit use to prevent abuse, or suspend AI features for an account that breaks the Acceptable Use Policy."
        ]
      },
      {
        heading: "Prohibited AI use",
        blocks: [
          "Do not use OUTARCH's AI features to create malware, attack systems you are not authorised to test, get around a provider's safety measures, generate unlawful content, or process personal data you have no right to process."
        ]
      }
    ]
  },
  {
    id: "acceptable-use",
    path: "/acceptable-use",
    title: "Acceptable use policy",
    summary: "What you must not use OUTARCH for.",
    sections: [
      {
        heading: "Do not use OUTARCH to",
        blocks: [
          [
            "Break any law, or help someone else break one.",
            "Access, scan, test or disrupt computers, networks or accounts without the owner's permission.",
            "Create, spread or run malware, ransomware or other harmful code.",
            "Infringe anyone's intellectual property or privacy, or process personal data you have no lawful basis to process.",
            "Send spam, or harass, threaten or defraud anyone.",
            "Get around plan limits, share an account with people outside your plan, or resell access to OUTARCH or its built-in AI.",
            "Overload, probe or attack OUTARCH's account, update or AI services, or try to reach data that is not yours.",
            "Use the built-in AI models in a way their providers prohibit."
          ]
        ]
      },
      {
        heading: "Security research",
        blocks: [
          "Good-faith security research on OUTARCH itself is welcome when it follows the Security & responsible disclosure policy."
        ]
      },
      {
        heading: "If this policy is broken",
        blocks: [
          "We may remove access to AI features, suspend or close the account, and report unlawful activity where the law requires it, as the Terms of service describe."
        ]
      }
    ]
  },
  {
    id: "mobile",
    path: "/mobile-privacy",
    title: "Mobile companion privacy",
    summary: "What the phone companion stores, what it can reach and every permission it uses.",
    sections: [
      {
        heading: "How the companion works",
        blocks: [
          "The phone companion is a web page your OUTARCH desktop app serves on your local network. Your phone talks to your computer directly over that network. Every message is encrypted with a key only your phone and your computer hold (X25519 key exchange and AES-256-GCM), and nothing passes through OUTARCH's servers.",
          "The connection address is plain http on your local network, so the encryption is done by the page itself. Use it only on networks you trust."
        ]
      },
      {
        heading: "Pairing",
        blocks: [
          "You pair a phone by opening the address or QR code shown in the desktop app and checking that the 6-digit code matches. The code proves the key exchange and is not sent over the network. Each phone gets its own key. You can revoke a phone on the desktop or unpair it from the phone."
        ]
      },
      {
        heading: "What the phone can see and do",
        blocks: [
          "You choose on the desktop what each phone may do when you pair it:",
          [
            "See terminals, their status and what needs you.",
            "Read recent terminal output, with secrets redacted (only with the terminal-reading permission).",
            "Ask Mission AI read-only questions (only if allowed). Your computer sends the question to its AI provider, as the AI & Developer Data notice describes.",
            "Start, restart and run recipes (only if allowed). Unless the desktop setting to run phone requests without asking is on, each request waits for approval on the desktop. Stopping and cancelling always wait for the desktop.",
            "Read project memory."
          ],
          "The phone cannot open files, read environment values or run arbitrary commands."
        ]
      },
      {
        heading: "What the phone stores",
        blocks: [
          "In your phone browser's storage for the companion page: the pairing credential for this phone, your alert preferences (sound, vibration, notifications) and a short list of recent alerts and actions. Unpairing deletes the credential. Clearing the site's data in your browser deletes all of it."
        ]
      },
      {
        heading: "Permissions",
        blocks: [
          [
            "Network: needed to reach your computer on your local network. The companion does not contact any other server.",
            "Notifications (optional): only if you turn them on in More. Used to show alerts from your computer. Your browser shows them only on a secure (https) connection; otherwise alerts appear inside the page while it is open.",
            "Vibration and sound (optional): short alerts you can turn off in More.",
            "Add to Home Screen (optional): installs the page like an app. A small offline helper (service worker) is registered for the page.",
            "Not used: camera, microphone, location, contacts, photos and files, clipboard reading, background location, analytics, advertising, crash reporting and push notifications from any server."
          ]
        ]
      },
      {
        heading: "Android client",
        blocks: [
          "If you install the OUTARCH Android client, it uses the internet permission (to reach your computer on your local network) and the biometric permission (to confirm your identity before a sensitive review, only when you ask). Its pairing credential is protected by the Android Keystore and it is excluded from Android backups. It collects no analytics and has no crash reporting."
        ]
      }
    ]
  },
  {
    id: "cookies",
    path: "/cookies",
    title: "Cookie policy",
    summary: "What the OUTARCH website stores in your browser, and why there is no cookie banner.",
    sections: [
      {
        heading: "No tracking",
        blocks: [
          "The OUTARCH website does not use advertising, analytics, social media or tracking cookies or scripts, and it does not set cookies of its own. Because it stores only what the site needs to work, it does not ask for cookie consent. If that ever changes, optional storage will not be used until you agree to it."
        ]
      },
      {
        heading: "What the website stores",
        blocks: [
          [
            "outarch-website-session (local storage): your sign-in session on the website, so you stay signed in on the Account and Pricing pages. Removed when you sign out.",
            "outarch-currency (local storage): the currency you picked for prices.",
            "Signing in for the desktop app stores nothing in the browser; the session is handed straight to the app."
          ]
        ]
      },
      {
        heading: "Other sites",
        blocks: [
          [
            "Sign in with Google takes you to Google, which uses its own cookies under Google's policies.",
            "When online checkout is available, the payment window is provided by the payment provider, which may use its own cookies or storage to process the payment and prevent fraud."
          ]
        ]
      },
      {
        heading: "The desktop app",
        blocks: [
          "The desktop app keeps its preferences in its own storage on your computer. Its built-in browser for your local development pages keeps those pages' cookies and storage on your computer, separate from your normal browser."
        ]
      },
      {
        heading: "Your control",
        blocks: [
          "You can clear local storage for the OUTARCH website in your browser's site settings at any time. You will be signed out of the website."
        ]
      }
    ]
  },
  {
    id: "retention",
    path: "/data-retention",
    title: "Data retention & deletion",
    summary: "How long each kind of data is kept, and how to delete it or your account.",
    sections: [
      {
        heading: "Data we hold",
        blocks: [
          [
            "Account, profile and plan: while your account exists.",
            "Built-in Mission AI message records: two days. The content of messages is never stored by us.",
            "Daily usage counters: while your account exists.",
            "Plan requests: while your account exists, or until you ask us to delete them.",
            "Sign-in and security logs kept by our authentication provider: for the period that provider keeps them.",
            "Records we must keep by law (for example tax or accounting records for payments): for as long as the law requires, even after the account is deleted."
          ]
        ]
      },
      {
        heading: "Deleting your account",
        blocks: [
          "To delete your account, contact {contact} from the email address on your account. We confirm the request is yours, then delete your account, profile, plan, usage and message records and plan requests, except records the law requires us to keep. We aim to do this within 30 days and will tell you when it is done.",
          "Deleting your account does not delete anything on your computer or phone."
        ]
      },
      {
        heading: "Data on your computer",
        blocks: [
          "Data on your computer stays until you delete it. Uninstalling the app does not delete it. To remove it:",
          [
            "OUTARCH's data folder (%APPDATA%\\OUTARCH): your sign-in session, encrypted keys and tokens, preferences and diagnostics. Delete the folder, or sign out and remove keys in the app first.",
            "Your project folders: the project file, activity history and arch_memory.md that OUTARCH writes there. Delete them like any other file.",
            "Mission AI API keys: remove them in Integrations > Mission AI.",
            "Paired phones and MCP tokens: revoke them in Integrations."
          ]
        ]
      },
      {
        heading: "Data on your phone",
        blocks: [
          "Unpair the phone from the companion's More tab, or clear the companion site's data in your phone's browser."
        ]
      },
      {
        heading: "Data held by others",
        blocks: [
          "AI providers, MCP clients and other services you connect keep what they receive under their own retention policies. Ask them directly to delete it."
        ]
      }
    ]
  },
  {
    id: "security",
    path: "/security",
    title: "Security & responsible disclosure",
    summary: "How OUTARCH protects your data, and how to report a vulnerability.",
    sections: [
      {
        heading: "How OUTARCH is built",
        blocks: [
          [
            "Local engine: one engine on your computer owns every terminal. The app's interface runs isolated from your system and reaches the engine only through checked requests.",
            "Encrypted credentials: your sign-in session, AI keys, MCP tokens and phone pairing keys are encrypted with Windows' data protection for your user account. OUTARCH refuses to store them where that protection is not available.",
            "Approval before action: Mission AI actions, MCP changes and phone stop requests wait for your approval unless you allow them in advance.",
            "Local-only connections: the MCP gateway and the VS Code bridge listen only on this computer. The phone companion is encrypted end to end on your local network.",
            "Redaction: context given to Mission AI, MCP clients and phones leaves out files that hold secrets and replaces values that look like secrets.",
            "Signed updates: updates install only after their signature is checked against the OUTARCH release key.",
            "Account data: stored in Supabase with row-level security, so a signed-in account can read only its own records. Built-in AI keys are readable only by the AI proxy."
          ],
          "No software is free of vulnerabilities. These measures reduce risk; they do not remove it."
        ]
      },
      {
        heading: "Your part",
        blocks: [
          [
            "Keep Windows, OUTARCH and your coding tools up to date.",
            "Review commands before you approve them, and use \"Always allow here\" sparingly.",
            "Keep secrets out of source files and terminal output where you can.",
            "Pair phones only on networks you trust, and revoke phones and tokens you no longer use."
          ]
        ]
      },
      {
        heading: "Reporting a vulnerability",
        blocks: [
          "If you find a security problem in OUTARCH, please report it privately: contact {contact} with \"Security\" in the subject. Include what you found, the steps to reproduce it and the version you tested. Please do not share it publicly until we have had a reasonable time to fix it.",
          "We will acknowledge your report, keep you updated and credit you if you want. We will not take legal action against good-faith research that follows these rules:",
          [
            "Test only against your own account and your own computer.",
            "Do not access, change or delete other people's data, and stop as soon as you reach data that is not yours.",
            "Do not degrade the service for others (no denial-of-service or load testing).",
            "Do not use social engineering or physical attacks."
          ]
        ]
      },
      {
        heading: "If something goes wrong",
        blocks: [
          "If we learn of a breach that affects your personal data, we will contain it, investigate, and notify you and the authorities where the law requires."
        ]
      }
    ]
  },
  {
    id: "subprocessors",
    path: "/subprocessors",
    title: "Third-party services",
    summary: "Every outside service that can receive personal data from OUTARCH, and why.",
    sections: [
      {
        heading: "Services we use",
        blocks: [
          [
            "Supabase: sign-in, account database, plan checks, release downloads and the AI proxy. Receives your account data and sign-in requests. Hosted in Mumbai, India.",
            "Google: Sign in with Google (if you choose it), and Gemini as a built-in Mission AI model. Receives your Google sign-in, and Mission AI requests sent to Gemini.",
            "NVIDIA: a built-in Mission AI model provider. Receives Mission AI requests sent to its models.",
            "Our website hosting provider: serves the website and, like any web host, sees the IP address and browser of each visit."
          ],
          "When online checkout becomes available, the payment provider will be listed here with what it receives."
        ]
      },
      {
        heading: "Services you choose",
        blocks: [
          "These receive data only if you connect them, and they act under their own terms, not on our behalf: AI providers you add with your own API key (such as OpenAI, Anthropic, Google, OpenRouter, NVIDIA, Groq, Mistral, DeepSeek and the others listed in the app), MCP clients you connect, VS Code, and the tools and coding agents you run in your terminals."
        ]
      },
      {
        heading: "Changes",
        blocks: [
          "We update this page before a new service starts receiving personal data from OUTARCH."
        ]
      }
    ]
  },
  {
    id: "licenses",
    path: "/licenses",
    title: "Open-source licences",
    summary: "The open-source software OUTARCH is built with, and its licences.",
    sections: [
      {
        heading: "Thank you",
        blocks: [
          "OUTARCH is built on open-source software. Each component below keeps its own licence and copyright notices, which are included with the software. The full list of components and licences ships with the app as THIRD_PARTY_LICENSES.md."
        ]
      },
      {
        heading: "Desktop app",
        blocks: [
          [
            "Electron (MIT), which includes Chromium (BSD-3-Clause and others) and Node.js (MIT)",
            "React and React DOM (MIT)",
            "xterm.js and its fit add-on (MIT)",
            "node-pty (MIT)",
            "Radix UI primitives (MIT)",
            "cmdk (MIT)",
            "Ink and ink-text-input (MIT), for the terminal interface",
            "Inter and JetBrains Mono typefaces (SIL Open Font License 1.1)"
          ]
        ]
      },
      {
        heading: "Website",
        blocks: [
          [
            "React and React DOM (MIT)",
            "Supabase JavaScript client (MIT)",
            "Framer Motion (MIT)",
            "Lenis (MIT)",
            "Phosphor Icons (MIT) and Lucide (ISC)",
            "clsx and tailwind-merge (MIT)",
            "Cashfree JS (MIT)",
            "Geist, Geist Mono, Inter and JetBrains Mono typefaces (SIL Open Font License 1.1)"
          ]
        ]
      }
    ]
  }
];

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

export const POLICIES = freezeDeep(POLICY_LIST);

export function policyById(id) {
  return POLICIES.find(policy => policy.id === id) || null;
}

export function policyByPath(path) {
  return POLICIES.find(policy => policy.path === path) || null;
}

// Fills {operator}, {contact} and {jurisdiction}. Unknown words stay as they
// are, so a missing value shows up in review instead of vanishing.
export function fillPolicyText(text, values = {}) {
  return String(text).replace(/\{(operator|contact|jurisdiction)\}/g, (whole, key) => {
    const value = values[key];
    return typeof value === "string" && value.trim() ? value.trim() : whole;
  });
}
