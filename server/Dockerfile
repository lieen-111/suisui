# 碎碎清单 Pro 后台 · docker build -t suisui-pro server && docker run -d -p 8787:8787 -v suisui-data:/data --restart unless-stopped suisui-pro
FROM node:22-alpine
WORKDIR /srv
COPY index.mjs ./
COPY admin ./admin
ENV PORT=8787 DATA_DIR=/data TRUST_PROXY=1 NODE_NO_WARNINGS=1
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "index.mjs"]
