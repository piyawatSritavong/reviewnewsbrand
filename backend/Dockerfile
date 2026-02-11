# Stage 1: Build the application
# ใช้ golang:alpine เพื่อให้ได้ Go เวอร์ชันล่าสุด
FROM golang:alpine AS builder

# ติดตั้ง git เพราะบาง library ของ Go จำเป็นต้องใช้ในการดาวน์โหลด
RUN apk add --no-network --no-cache git || apk add --no-cache git

WORKDIR /app

# คัดลอกไฟล์จัดการ Library เบื้องต้น
COPY go.mod go.sum ./

# คัดลอกโค้ดทั้งหมดเข้าไปก่อนเพื่อให้ go mod tidy ตรวจสอบ imports ได้
COPY . .

# ตรวจสอบโค้ดและดาวน์โหลด Library ที่ขาดหายไป (Gemini, Cron, Dotenv) อัตโนมัติ
RUN go mod tidy

# ระบุตำแหน่งไฟล์ main.go ให้ถูกต้องตามโครงสร้างโปรเจกต์ (cmd/server/main.go)
RUN go build -o main ./cmd/server/main.go

# Stage 2: Run the application
FROM alpine:latest
WORKDIR /root/

# คัดลอกไฟล์ที่ Build เสร็จแล้วมาจาก Stage 1
COPY --from=builder /app/main .

# เปิดพอร์ต 8080
EXPOSE 8080

# คำสั่งรัน
CMD ["./main"]