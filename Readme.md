# Fruit Harvest Dashboard

## Overview

This project is a web application for managing fruit harvesting data. It features a login page and a dashboard that displays various charts and tables to visualize harvesting information. The frontend is built using Next.js 14 with Tailwind CSS for styling, and the backend is powered by Django Rest Framework.

## Features

- **Login Page**: Users can log in to access the dashboard.
- **Dashboard**: Visualizes fruit harvesting data with tables, bar charts, and line charts.
- **Responsive Design**: Fully responsive and styled using Tailwind CSS.
- **Mock Data**: Uses mock data for development and testing purposes.

## Technologies

- **Frontend**: Next.js 14, Tailwind CSS
- **Backend**: Django Rest Framework (not included in this repository)
- **Charting**: Chart.js

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Docker](https://www.docker.com/) (for containerization)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/fruit-harvest-dashboard.git
   cd fruit-harvest-dashboard
   ```

2. **Install dependencies**

```bash
Copy code
npm install
Run the development server
```

```bash
Copy code
npm run dev
```
Open your browser and navigate to http://localhost:3000 to see the application in action.

### Docker
To build and run the application using Docker:

2. **Build the Docker image**

```bash
Copy code
docker build -t nextjs-app .
```
Run the Docker container

```bash
Copy code
docker run -p 3000:3000 nextjs-app
```
Access the application at http://localhost:3000.

### Usage
1. **Navigate to the login page.**
2. **Enter your credentials and log in.**
3. **Once logged in, you'll be redirected to the dashboard where you can view harvesting data visualized with charts and tables.**
### Contributing
Contributions are welcome! Please fork the repository and submit a pull request with your changes.

### License
This project is licensed under the MIT License. See the LICENSE file for details.

### Acknowledgements
Next.js - React framework for building user interfaces.
Tailwind CSS - Utility-first CSS framework.
Chart.js - JavaScript library for charting.