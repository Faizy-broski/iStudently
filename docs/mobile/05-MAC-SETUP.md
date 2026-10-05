# Mac setup, step by step

## A. On the Windows machine (once)
The folder is not a git repo yet.
```
cd D:\thesocialnexus\studently
git init
git add -A
git status            # CHECK: no .env, .env.local, .env.production, node_modules, data.sql staged
git commit -m "Baseline: Studently + mobile project docs"
git branch -M main
git remote add origin git@github.com:<you>/studently.git   # create a PRIVATE repo first
git push -u origin main
```
Secrets are NOT in git. Put these in a password manager and copy by hand to the Mac: `backend/.env`, `frontend/.env.local`, `scanner-app/.env.production`. Keep the Windows copy until the Mac copy runs. Consider rotating the Supabase service-role key if the folder was ever shared.

## B. Mac tools
```
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22 watchman git gh
brew install --cask android-studio
sudo gem install cocoapods     # or: brew install cocoapods
```
- Install Xcode from the App Store, open once, accept the license, add an iOS simulator.
- Android Studio: install SDK + one emulator; set `ANDROID_HOME`.
- Claude Code: install per Anthropic docs, then `claude` and log in with the NEW account.
- Accounts: Apple Developer (99 USD/yr), Google Play (25 USD once), Expo (EAS), Firebase.

## C. Get the code
```
git clone git@github.com:<you>/studently.git && cd studently
cp <secure-location>/backend.env backend/.env
cp <secure-location>/frontend.env.local frontend/.env.local
(cd backend && npm install) ; (cd frontend && npm install) ; (cd scanner-app && npm install)
(cd backend && npm run dev)      # :5000
(cd frontend && npm run dev)     # :3000
```
Windows path notes: docs use Windows paths in places; ignore drive letters. `backend/.htaccess`, cPanel and Passenger files are deploy-only.

## D. Start working with Claude
```
cd studently
claude
> /sprint-start
```
Claude reads `CLAUDE.md` and `docs/mobile/*`, then plans the current sprint. Work one branch per sprint (`git switch -c sprint-01-foundations`). Before ending a session: "update PROGRESS.md and tick the sprint checklist".

## E. Mobile app bootstrap (Sprint 1)
```
npx create-expo-app@latest mobile --template default
cd mobile && npx expo install expo-dev-client expo-secure-store expo-notifications expo-camera expo-location expo-sqlite @react-native-community/netinfo
cp ../mobile.env.example .env
npx expo run:ios       # simulator (needs Xcode)
npx expo run:android
npm i -g eas-cli && eas login && eas build:configure
```
Check the Expo SDK's React version vs the web's pinned 19.2.3 before wiring `packages/*`.
Real iPhone: Xcode signing with your Apple ID (dev build) or `eas build --profile development --platform ios`.
Push on iOS needs a real device and an APNs key in Firebase/EAS.

## F. Checklist before Sprint 1 starts
- [ ] Private repo pushed, clone works on the Mac
- [ ] backend and web run locally against staging Supabase (not production data)
- [ ] HTTPS API hostname known
- [ ] Apple, Google, Firebase, Expo accounts opened
- [ ] Staging data for each role
- [ ] Designer or UI kit decided
