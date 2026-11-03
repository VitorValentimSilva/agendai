-- Impede agendamento duplo no nível do banco, inclusive sob concorrência.
-- Dois agendamentos não-cancelados do mesmo profissional não podem ter
-- intervalos [início, fim) que se sobrepõem.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_no_overlap"
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELED');

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_valid_range" CHECK ("endsAt" > "startsAt");

ALTER TABLE "TimeOff"
  ADD CONSTRAINT "TimeOff_valid_range" CHECK ("endsAt" > "startsAt");

ALTER TABLE "WorkingHours"
  ADD CONSTRAINT "WorkingHours_valid_range"
  CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute"
         AND "weekday" BETWEEN 0 AND 6);
