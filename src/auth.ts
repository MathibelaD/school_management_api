import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import express from 'express';
import { env } from 'process';
const router = express.Router();

const secret = process.env.ACCESS_TOKEN_SECRET as string;
const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

const extractDoB = (idNumber: string) => {
  const dateOfBirthString = idNumber.substr(0, 6);
  const year = parseInt(dateOfBirthString.substr(0, 2), 10);
  const month = parseInt(dateOfBirthString.substr(2, 2), 10) - 1;
  const day = parseInt(dateOfBirthString.substr(4, 2), 10);
  const currentYear = new Date().getFullYear();
  const fullYear = currentYear - (currentYear % 100) + year;
  const dateOfBirth = new Date(fullYear, month, day);

  const formattedDateOfBirth = `${dateOfBirth.getFullYear()}-${(dateOfBirth.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${dateOfBirth.getDate().toString().padStart(2, '0')}`;

  const genderDigit = idNumber.charAt(6);
  const gender = genderDigit === '0' ? 'Female' : 'Male';

  return { dob: formattedDateOfBirth, gender };
}

router.post('/create_user', async (req: any, res: any) => {
  try {
    const {
      firstName, lastName, idNumber, dateOfBirth, gender,
      email, phoneNumber, address, role, password, profilePicture
    } = req.body;
    
    const hashedPassword = await hashPassword(password);
    const result = await prisma.user.create({
      data: {
        firstName, lastName, idNumber, dateOfBirth, gender,
        email, phoneNumber, address, role, profilePicture, password: hashedPassword
      }
    });
    res.status(201).json({ result: result, message: 'User Created Successfully', success: true });
  } catch (error) {

    res.status(404).send('Not found');
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User does not exist' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const payload = {
      id: user.id,
      uniqueIdentifier: Date.now().toString()
    };
    const expiresIn = env.EXPIRY_TIME;
    const token = jwt.sign(payload, secret, { expiresIn });
    res.set('Authorization', `Bearer ${token}`);
    res.set("Access-Control-Expose-Headers", "*")

    return res.json({ token: token, user: user, message: 'Login successful', success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', success: false });
  }
});

router.put('/update', async (req: any, res: any) => {
  const { idNumber, ...rest } = req.body;
  const id = req?.user?.id
  try {

    const { dob, gender } = extractDoB(idNumber)
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...rest,
        dateOfBirth: dob,
        gender,
        idNumber
      }
    })
    return res.json({ user: user, message: 'Update successful', success: true });
  } catch (error) {
    return res.status(404).json({ message: `Update failed ${error}`, success: false });
  }
})

router.get('/test', (req: any, res: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  res.json({ message: 'Welcome!', user: req.user });
})

router.post('/upload', async (req: any, res: any) => {
  const { image } = req.body;
  const id = req?.user?.id
  console.log(req.body)

  try {
      const buffer = Buffer.from(image, 'base64');
      const updatedUser = await prisma.user.update({
          where: { id },
          data: { profilePicture: buffer },
      });
      res.json({ message: 'User image updated!', user: updatedUser });
    
  } catch (error) {
      res.status(500).json({ error: 'Error updating user image' });
  }
});

router.get('/getuser', async (req: any, res: any) => {
  const id = req?.user?.id
  let photo = ""
  try {

      const user = await prisma.user.findUnique({
          where: { id },
      });

      if (user && user.profilePicture) {
         photo = Buffer.from(user.profilePicture).toString('base64');
    }
      res.json({ photo, user, message: "User successfully retrieved", success: true });
  } 
  catch (error) 
  {
      res.status(404).json({ message: `Error retrieving user ${error}`, success: false});
  }
});

router.get('/stats', async (req: any, res: any) => {
  try
  {
    const totalStudents = await prisma.student.count();
    const totalTeachers = await prisma.teacher.count();
    const totalParents = await prisma.parent.count();
  
    res.json({totalStudents, totalTeachers, totalParents, message: "stats success", success: true});
  }
  catch(error)
  {
    res.status(404).json({ error: 'Error getting stats' });
  }
});




export default router;
