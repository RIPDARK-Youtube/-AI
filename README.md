# 𝕯𝕬𝕽𝕶 AI

Starter pentru un chat AI cu mai mulți furnizori care răspund în paralel. Un coordonator încearcă să combine ideile într-un singur răspuns final.

## Ce include
- Interfață responsive pentru telefon și desktop, cu temă dark/red.
- Mod „Gândire maximă”: interoghează în paralel toți furnizorii configurați, cu roluri diferite, apoi cere unui model să sintetizeze răspunsurile.
- Mod „Rapid”: trimite doar contextul recent, dar în această versiune tot așteaptă răspunsurile modelelor configurate.
- Suport pentru Groq, Mistral, OpenRouter, Gemini API și Cloudflare Workers AI.
- Cheile API sunt citite pe server din `.env`; nu sunt trimise către browser.
- Afișează care furnizori sunt configurați și care au eșuat.

## Important despre costuri și viteză
Nu există garanție că toate serviciile oferă gratuit acces nelimitat. Trebuie respectate termenii, limitele și regulile fiecărui furnizor. Apelarea mai multor modele consumă limitele fiecăruia și este de obicei mai lentă decât un singur model. Coordonarea face un apel suplimentar. Dacă nu ai setat nicio cheie API, chatul nu poate genera răspunsuri AI.

## Rulare locală
Ai nevoie de Node.js 20+.

1. Dezarhivează proiectul.
2. Rulează `npm install`.
3. Copiază `.env.example` în `.env`.
4. Pune cheia pentru cel puțin un furnizor în `.env`.
5. Rulează `npm start`.
6. Deschide `http://localhost:3000`.

Nu încărca niciodată `.env` pe GitHub. Fișierul este exclus prin `.gitignore`.

## Configurare furnizori
- Groq: https://console.groq.com/
- Gemini: https://aistudio.google.com/
- Mistral: https://console.mistral.ai/
- OpenRouter: https://openrouter.ai/
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/

Model names and free availability can change. Check each provider dashboard and docs.

## GitHub și publicare
GitHub este locul unde ții codul; GitHub Pages nu rulează acest server Node.js și nu poate ține secretele API în siguranță. Pentru aplicația completă, publică backend-ul pe un host care suportă Node.js și configurează variabilele `.env` ca environment variables în setările hostului. Planurile gratuite și condițiile lor se pot schimba.

## Limitări actuale
- Fără conturi de utilizator, bază de date sau salvare permanentă a conversațiilor.
- Fără streaming real al tokenilor; interfața afișează un indicator în timpul procesării, apoi răspunsul complet.
- „Gândire maximă” nu garantează corectitudine. Modelele pot greși sau pot repeta aceleași erori.
- „Rapid” este momentan un mod de context scurt, nu un fallback de tip first-response-wins. Pentru cea mai mică latență, folosește un singur furnizor rapid sau dezvoltă o rută separată care returnează primul răspuns valid.
