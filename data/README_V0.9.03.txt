Vélo ID V0.9.03 — Fiabilisation Synchro Supabase

Fichiers à uploader sur GitHub Pages :
- index.html
- dossier js/
- dossier data/

Avant test synchro :
1. Dans Supabase > SQL Editor, exécuter supabase_veloid_records.sql.
2. Dans Vélo ID > Paramètres > Synchro Cloud, vérifier Project URL et anon key.
3. Se connecter par magic link.
4. Cliquer sur le bouton Synchro existant.

Notes :
- Le bouton existant est conservé.
- Les données locales restent conservées si Supabase est indisponible.
- La synchro utilise maintenant la table veloid_records avec fusion par record_type / record_id / updated_at.
