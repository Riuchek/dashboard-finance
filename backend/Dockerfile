FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 go build -o /server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /server /app/server
EXPOSE 8080
CMD ["/app/server"]
