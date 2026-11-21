# Test Cases — Student Details Edit

**Source:** `docs/new/Hi5_Portal_Student_Details_Edit_Expected_Behavior.md`
**Prepared:** November 21, 2026

---

## How to use this file

- **Who can edit:** Administrator, Registrar, Enrollment Committee. **Teacher and Principal see the learner read-only** (no Edit Details button).
- The learner profile is at `/student/<id>` — from the Registrar's **Students** page, click a learner.
- The edit panel opens as an inline dialog on the profile's Personal Information tab; the **Change History** tab next to it lists every past change.
- Choose one demo learner as your test subject and keep using them through all cases.

---

## S1. Teacher and Principal cannot edit

**Log in as:** a Teacher (or Principal)
1. Open the test learner's profile.

**Expected:** There is **no** "Edit Details" button anywhere. All information is read-only.

☐ Pass ☐ Fail

---

## S2. Routine fields edit freely (no reason asked)

**Log in as:** `committee01`
1. Open the learner's profile → **Edit Details**.
2. Change a **routine** field only — e.g. **Contact Number** or **House #/Street**.
3. Save.

**Expected:** It saves **immediately** — no reason is requested for routine fields (contact, guardian, address parts, ZIP, parents, mother tongue, IP, religion, 4Ps, height, weight).

☐ Pass ☐ Fail

---

## S3. Save is blocked until something changes

1. Open **Edit Details** and press Save **without changing anything**.

**Expected:** The Save button is disabled until you actually change a value.

☐ Pass ☐ Fail

---

## S4. Identity fields require a reason

1. Open **Edit Details** and change an **identity** field — First name, Last name, Middle name, Name Suffix, LRN, Birthdate, or Sex.
2. Try to save without picking a reason.

**Expected:** A **Reason** dropdown appears for identity changes (options: `Typo`, `Per birth certificate`, `Per LIS or LRN record`, `Other`). Saving is blocked until a reason is chosen. Choosing **Other** requires a short note.

☐ Pass ☐ Fail

---

## S5. Confirmation dialog shows each change

1. Change two fields (one routine, one identity with reason) and press Save.

**Expected:** A confirmation dialog lists **every change** with its **old → new value** before anything is saved; nothing changes until you confirm.

☐ Pass ☐ Fail

---

## S6. The profile and forms reflect the change

1. After saving a name change, check the learner's name on the profile header and reprint SF1 (or check the Student Search list).

**Expected:** The new name shows everywhere immediately, in the standard format, and the change is dated.

☐ Pass ☐ Fail

---

## S7. Changed School Form cells reset for identity changes

1. Before editing, use the SF1 editor to save a manual edit on the learner's name row (e.g. retype the name and save).
2. Then change the learner's **name** via Edit Details (with reason).

**Expected:** The stale SF1 name cell is reset — SF1 now prints the corrected learner name, not the old typed-over one.

☐ Pass ☐ Fail

---

## S8. Duplicate LRN is blocked and identifies the other learner

1. Open **Edit Details** and set the learner's **LRN** to the LRN of a **different existing learner** (find one on the Students page first).
2. Save.

**Expected:** The save is **rejected** with a clear message that names the conflicting learner (their name and LRN) — no partial save happens. The same message also **pops up as a toast** so it cannot be missed.

☐ Pass ☐ Fail

---

## S9. A same-name-but-different learner is only a warning

1. Change the learner's name to exactly match another learner (first, middle, last) but keep the LRN different.
2. Save.

**Expected:** A **warning** appears that a learner with the same name exists (twins exist!), but the save is allowed.

☐ Pass ☐ Fail

---

## S10. Change History lists everything

1. Open the **Change History** tab on the profile.

**Expected:** Every change from S2–S9 is listed with: the **field** (human label), **old → new value**, the **reason** (for identity fields), **who** made the change, and the **date and time**.

☐ Pass ☐ Fail

---

## S11. Someone else edited first — you are not silently overwritten

1. On **two laptops** (or two browsers), open **Edit Details** for the same learner as two different users (e.g. `committee01` and `registrar01`).
2. User A saves a change to the Contact Number.
3. User B (who had the panel open from before) changes the Guardian and saves.

**Expected:** User B gets a **conflict** message — the panel reloads with the latest values instead of silently overwriting User A's save, and a **toast** announces the conflict. Nothing is lost.

☐ Pass ☐ Fail

---

## S12. Graduated learners are identity-locked (Administrator can still fix)

1. Find a learner with status **Graduated** (Graduates page shows some).
2. As `committee01` or `registrar01`, open **Edit Details** and try to change their name/birthdate/sex/LRN.

**Expected:** The save is **blocked** — identity fields of graduated (and closed-school-year) learners are locked. Routine fields (contact, address) can still be edited.

3. Log in as **Administrator** and make the same identity change.

**Expected:** The Administrator **can** edit it (with a reason).

☐ Pass ☐ Fail

---

## S13. Archived learners are Administrator-only

1. Find an archived learner (if the school has any — ask the Administrator; archived learners no longer appear in normal lists).

**Expected:** Only the Administrator can open/edit them. Committee/Registrar get a clear "archived" message.

☐ Pass ☐ Fail

---

## S14. No approval step

1. Make a routine edit and confirm.

**Expected:** The change applies **immediately** — there is no approval queue and no waiting; the confirmation dialog you saw in S5 is the only confirmation.

☐ Pass ☐ Fail

---

## S15. Activity Log records the edit

**Log in as:** Administrator → **Activity Logs**

**Expected:** Each details edit appears with the user, the learner, and the date/time.

☐ Pass ☐ Fail

---

## Sign-off

| Tested by | Date | Result |
|---|---|---|
| | | |
