import { faker } from '@faker-js/faker'
import { mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { hash } from 'argon2'
import { ObjectId } from 'mongodb'
import randomatic from 'randomatic'

interface User {
  _id: ObjectId
  forename: string
  surname: string
  email: string
  password: string
  active: boolean
  area: ObjectId
}

const rootDir = resolve(process.cwd())

const devices = ['Pc Escritorio', 'Pc Portátil', 'Monitor', 'Impresora', 'Teclado', 'Mouse', 'Escáner', 'Teléfono', 'Otro']
const titlePrefixes = [' presenta problemas', ' no está funcionando', ' me está fallando', ' dejó de funcionar']
const backups = ['Si', 'No', 'No lo sé']
const statuses = ['En espera', 'En proceso', 'Completado', 'Cancelado']
const today = new Date()
const past = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate())
const types = ['Hardware', 'Software', 'Internet']

function csvMaker(data: Array<any>) {
  return Object.keys(data[0]).join(',') + '\n' + data.map(d => Object.values(d).map(o => {
    if (o instanceof Date) return o.toJSON()
    else if (o instanceof ObjectId) return o.toString()
    else return o
  }).join(',')).join('\n')
}

async function generateBusinessUnits(quantity: number, additionalUnits: string[]) {
  function newUnit(unitName?: string) {
    const _id = new ObjectId()
    const name = unitName || faker.name.jobArea()
    const code = name.substring(0, 3).toUpperCase()
    const numberPhone = faker.phone.phoneNumber('+51333#######')
    const extension = faker.datatype.number({ max: 999 })
    return { _id, name, code, numberPhone, extension }
  }
  const units = Array.from(Array(quantity).keys()).map(() => newUnit())
  units.push(...additionalUnits.map(u => newUnit(u)))
  await writeFile(join(rootDir, 'data', `units.json`.trimStart()), JSON.stringify(units))
  await writeFile(join(rootDir, 'data', `units.csv`.trimStart()), csvMaker(units))
  return units
}

function generateUsers(quantity: number, role: 'employee' | 'technician', area: { _id: ObjectId, name: string }) {
  const users = Array.from(Array(quantity).keys()).map(() => {
    const _id = new ObjectId()
    const forename = faker.name.firstName()
    const surname = faker.name.lastName()
    const email = faker.internet.email(forename, surname, 'esprezza.com')
    const password = randomatic('aA0!', 12)
    const active = true
    return { _id, forename, surname, email, password, active, area: area._id }
  })
  return users
}

async function generateUsersFiles(users: User[], prefix: string) {
  const usersData = await Promise.all(users.map(async u => ({ ...u, password: await hash(u.password) })))
  const loginsData = users.map(u => ({ email: u.email, password: u.password }))
  await writeFile(join(rootDir, 'data', `${prefix}users.json`.trimStart()), JSON.stringify(usersData))
  await writeFile(join(rootDir, 'data', `${prefix}users.csv`.trimStart()), csvMaker(usersData))
  await writeFile(join(rootDir, 'data', `${prefix}users-login.json`.trimStart()), JSON.stringify(loginsData))
  await writeFile(join(rootDir, 'data', `${prefix}users-login.csv`.trimStart()), csvMaker(usersData))
}

async function generateTickets(quantity: number, users: User[], technicians: User[]) {
  const tickets = Array.from(Array(quantity).keys()).map(() => {
    const randomDevice = Math.floor(Math.random() * (devices.length - 1))
    const device = devices[randomDevice]
    const tittle = randomDevice === (devices.length - 1) ? titlePrefixes[Math.floor(Math.random() * (titlePrefixes.length - 1))] + device : device
    const createdAt = faker.date.between(past.toDateString(), today.toDateString())
    const dateRequest = createdAt
    const createdAtHours = createdAt.getHours()
    const hours = createdAtHours < 10 ? `0${createdAtHours}` : createdAtHours
    const createdAtMinutes = createdAt.getMinutes()
    const minutes = createdAtMinutes < 10 ? `0${createdAtMinutes}` : createdAtMinutes
    const hour = `${hours}:${minutes}`
    const observation = faker.lorem.paragraph()
    const backup = randomDevice === 0 || randomDevice === 1 ? backups[Math.floor(Math.random() * (backups.length - 1))] : backups[1]
    const statusIndex = Math.floor(Math.random() * (statuses.length - 1))
    const status = statuses[statusIndex]
    const user = users[Math.floor(Math.random() * (users.length - 1))]
    const assignedBy = user._id.toString()
    const area = user.area.toString()
    const type = types[Math.floor(Math.random() * (statuses.length - 1))]
    const assignedTo = technicians[Math.floor(Math.random() * (technicians.length - 1))]._id
    const evaluation = statusIndex === 2 ? Math.floor(Math.random() * 4) : undefined
    const ticket: any = { tittle, dateRequest, hour, observation, backup, device, status, area, type, assignedBy, assignedTo, evaluation }
    return ticket
  })
  await writeFile(join(rootDir, 'data', `tickets.json`.trimStart()), JSON.stringify(tickets))
  await writeFile(join(rootDir, 'data', `tickets.csv`.trimStart()), csvMaker(tickets))
  return tickets
}

async function generateComplaints(quantity: number, users: User[], technicians: User[]) {
  const complaints = Array.from(Array(quantity).keys()).map(() => {
    const createdBy = users[Math.floor(Math.random() * (users.length - 1))]._id
    const technicianId = technicians[Math.floor(Math.random() * (technicians.length - 1))]._id
    const dateIncidence = faker.date.between(past.toDateString(), today.toDateString())
    const createdAt = dateIncidence
    const message = faker.lorem.paragraphs()
    const status = faker.datatype.boolean() ? 'leido' : 'No leido'
    return { createdBy, dateIncidence, technicianId, createdAt, message, status }
  })
  await writeFile(join(rootDir, 'data', `complaints.json`.trimStart()), JSON.stringify(complaints))
  await writeFile(join(rootDir, 'data', `complaints.csv`.trimStart()), csvMaker(complaints))
  return complaints
}

(async () => {
  try {
    await mkdir(join(rootDir, 'data'))
  } catch (error) {
    console.log('Data dir already created, skipping...')
  }
  const units = await generateBusinessUnits(4, ['Human Resources', 'Information Technologies'])
  let users: User[] = []
  let technicians: User[] = []
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (i === units.length - 1) {
      technicians = technicians.concat(generateUsers(20, 'technician', { _id: u._id, name: u.name }))
    } else users = users.concat(generateUsers(20, 'employee', { _id: u._id, name: u.name }))
  }
  await generateUsersFiles(users, 'employees-')
  await generateUsersFiles(technicians, 'technicians-')
  await generateTickets(666, users, technicians)
  await generateComplaints(123, users, technicians)
})();
