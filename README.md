# Roue de la chance

Roue de la chance avec mode équipe CS2. Site statique : ouvrir `index.html`.

## Docker

```bash
docker build -t roue-cs2 .
docker run -d --name roue -p 8080:80 --restart unless-stopped roue-cs2
```
