# Hi5 Portal: Finalized Expected Behavior

**Digital Requirements Upload, Name Suffix, and School Form Field Population**  
**Prepared:** November 9, 2026

---

# A. Digital Requirements Upload

## Purpose

Optional scanned copies of enrollment requirements are attached to a learner's **Enrollment Document Checklist**. The physical documents remain with the school.

## User Permissions

| Role                 | Upload / Replace | Delete | View |
| -------------------- | :--------------: | :----: | :--: |
| Enrollment Committee |       Yes        |  Yes   | Yes  |
| Registrar            |       Yes        |  Yes   | Yes  |
| Administrator        |        No        |   No   | Yes  |
| Teacher              |        No        |   No   |  No  |
| Principal            |        No        |   No   |  No  |

## Two Ways to Attach Files

### 1. During the Enrollment Form (Laptop Only)

- Uses the file picker only.
- Files selected while filling out the enrollment form are temporarily stored in the browser.
- Files are uploaded **only** when the Enrollment Committee presses **Save/Enroll**.
- If the Enrollment Committee cancels the enrollment, nothing is stored.

### 2. After Enrollment (Any Device)

Once enrollment is saved:

- The learner record exists in the database.
- The learner is placed in the **Pending Section Queue**.
- Each checklist item includes:
  - **Take Photo**
  - **Choose File**
- On an Android app or mobile browser:
  - Search for the learner by:
    - Name
    - LRN
    - Learner ID
  - Tap **Take Photo** to capture and upload a document.
- The uploaded file appears on the laptop within one or two seconds.
- The Registrar uses the same screen for:
  - Late document submissions
  - Transfer-In learners

## Verification

- There is **no separate approval step**.
- Uploading only attaches a digital copy.
- The checklist checkmark indicates that the Enrollment Committee verified the physical original.

### Checklist Rules

- Uploading a file does **not** automatically check the item.
- Checking the item does **not** require a file upload.

Each checklist item displays one of the following states:

1. Received (no digital copy attached)
2. Copy attached (not yet checked)
3. Received and copy attached

A missing document **does not block enrollment** and may be submitted later.

## File Rules

### Accepted File Types

- PDF
- JPG / JPEG
- PNG

Other file types, including **HEIC**, are rejected with a clear error message.

### File Limits

- Maximum **5 MB** per file
- Maximum **3 files** per requirement

Phone photos are compressed in the browser before upload.

### Security

- The actual file type is validated, not just the file extension.
- Files are renamed on the server.
- Files are stored privately.
- No public download links are created.

## Behavior and Safeguards

- Uploading files is separate from saving enrollment.
- Failed or slow uploads:
  - Display upload progress.
  - Provide a **Retry** button.
  - Never cause the learner record to be lost.

### File Management

Authorized users may:

- Replace uploaded files
- Delete uploaded files

All actions are recorded in the **Activity Log**, including:

- User
- Action performed
- Learner
- Date and time

Files can only be opened within the application by authorized roles listed above.

### Device Support

| Device         | Upload Method |
| -------------- | ------------- |
| Android App    | Camera        |
| Mobile Browser | Camera        |
| Laptop/Desktop | File Picker   |

---

# B. Name Suffix (Enrollment and School Forms)

## Enrollment Form

Add an optional **Name Suffix** field beside the:

- First Name
- Middle Name
- Last Name

### Dropdown Options

- Jr.
- Sr.
- II
- III
- IV
- V
- Other

## Data Storage

- Store the suffix in the learner record.
- Existing learners have no suffix until updated by the Registrar.

## Automatic Population

The suffix automatically appears in every generated School Form:

- SF1
- SF5
- SF9
- SF10

It also appears wherever the learner's name is displayed, including:

- Student lists
- At-Risk views
- Certificates

## Name Format

Display the learner's name consistently using the standard format:

> **DELA CRUZ, JUAN PEDRO Jr.**

Sorting remains based on **Last Name** only.

## Duplicate Enrollment Detection

Duplicate checking must include the suffix.

For example:

- Juan Dela Cruz Jr.
- Juan Dela Cruz Sr.

These should **not** be considered duplicate learners.

## LIS Import

If LIS Import is implemented, map the **LIS Extension Name** column to the **Name Suffix** field.

---

# C. School Form Field Population

## Rule

Any learner data stored by the system that has a corresponding field in a School Form must automatically populate that field.

Applicable forms:

- SF1
- SF5
- SF9
- SF10

## Saved Form Edits

Manual edits continue to behave as they do today:

- Saved per learner
- Saved per school year
- Saved per School Form

## Field Audit Matrix

Verify every available field using a **Field Audit Matrix**.

Each field should be classified as:

| Status               | Description                          |
| -------------------- | ------------------------------------ |
| Shown                | Stored and displayed on School Forms |
| Stored but Not Shown | Needs implementation                 |
| Not Stored           | Requires design decision             |
