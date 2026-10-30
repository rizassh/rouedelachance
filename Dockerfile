FROM nginx:alpine
COPY favicon.ico index.html style.css app.js /usr/share/nginx/html/
EXPOSE 80
