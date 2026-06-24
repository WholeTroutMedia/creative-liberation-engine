FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY packages/comet-mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY packages/comet-mobile/cert.pem /etc/nginx/conf.d/cert.pem
COPY packages/comet-mobile/key.pem /etc/nginx/conf.d/key.pem
COPY packages/comet-mobile/index.html /usr/share/nginx/html/index.html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
