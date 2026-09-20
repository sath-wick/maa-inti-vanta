# Maa Inti Vanta Console
A company-facing full-stack application made for a Cloud Kitchen.
## Core Features
- **Dynamic Menu & Inventory Management**:
Operators can add, edit, and remove items from a centralized master inventory. The system dynamically generates specific daily menus (Breakfast, Lunch, Dinner) that are instantly formatted for easy copy-pasting into WhatsApp customer broadcast groups.

- **Automated Billing & Order Processing**:
Generates precise customer invoices on the fly by mapping orders directly to that specific day's active menu items.

- **Customer & Revenue Management (CRM):**
Maintains a secure database of customer records and tracks core operational revenue across different business days.

- **Secure Internal Access**:
The entire platform is locked behind robust role-based authentication, ensuring data integrity and restricting access exclusively to authorized business operators.

## Tech Stack

- **Backend & Database**: Express JS & Firebase (Authentication, Realtime Database / Cloud Firestore)
- **Frontend**: React JS
- **Architecture**: RESTful data flow, dynamic state management, and secure routing.