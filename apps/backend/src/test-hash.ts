import bcrypt from 'bcryptjs';

async function generate() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);
    console.log("Chuẩn mã hóa của máy bạn cho '123456' là:");
    console.log(hash);
}

generate();
