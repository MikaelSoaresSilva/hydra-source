// Correção aplicada ao plugin @capacitor/local-notifications (Android):
// depois que um lembrete semanal dispara, o plugin reagenda a próxima semana com setExact(RTC),
// que o Android pode ADIAR quando o celular está em modo de economia (Doze).
// Trocamos por setExactAndAllowWhileIdle(RTC_WAKEUP), o mesmo usado no primeiro agendamento.
// Roda automaticamente após "npm install" (script postinstall).
import fs from 'node:fs';
const f = new URL('../node_modules/@capacitor/local-notifications/android/src/main/java/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.java', import.meta.url);
let src = fs.readFileSync(f, 'utf8');
if (src.includes('PATCH formacao-dev')) { console.log('patch já aplicado'); process.exit(0); }
const before = `alarmManager.set(AlarmManager.RTC, trigger, pendingIntent);`;
const before2 = `alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent);`;
if (!src.includes(before) || !src.includes(before2)) { console.error('Trecho esperado não encontrado: versão do plugin mudou?'); process.exit(1); }
src = src.replace(before, `alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent); // PATCH formacao-dev`)
         .replace(before2, `alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent); // PATCH formacao-dev`);
fs.writeFileSync(f, src);
console.log('patch aplicado em TimedNotificationPublisher.java');
