#!/bin/bash

echo "Starting Stock Market Project..."

# Go to project directory
cd /home/azureuser/StockMarket || exit

# Activate virtual environment
source venv/bin/activate

echo "Virtual environment activated"

# Go to Django project folder
cd AutoVest-Analytics || exit

# Apply migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

echo "Starting Gunicorn server..."

# Start gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000

echo "Backend running on port 8000"
