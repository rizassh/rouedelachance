FROM nginx:alpine
COPY fortune-wheel.ico index.html style.css app.js /usr/share/nginx/html/
EXPOSE 80
