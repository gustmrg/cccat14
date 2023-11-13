import crypto from "crypto";
import pgp from "pg-promise";

export function validateCpf(cpf: string) {
	if (!cpf) return false;
	cpf = clean(cpf);
	if (isInvalidLength(cpf)) return false;
	if (allDigitsAreTheSame(cpf)) return false;

	const dg1 = calculateDigit(cpf, 10);
	const dg2 = calculateDigit(cpf, 11);

	return extractCheckDigits(cpf) === `${dg1}${dg2}`;
}

function clean(cpf: string) {
	return cpf.replace(/\D/, "");
}

function isInvalidLength(cpf: string) {
	return cpf.length !== 11;
}

function allDigitsAreTheSame(cpf: string) {
	return cpf.split("").every(c => c === cpf[0])
}

function calculateDigit(cpf: string, factor: number) {
	let total = 0;
	for (const digit of cpf) {
		if (factor > 1) total += parseInt(digit) * factor--;
	}
	const rest = total % 11;
	return (rest < 2) ? 0 : 11 - rest;
}

function extractCheckDigits(cpf: string) {
	return cpf.slice(9);
}

export async function signup(input: any): Promise<any> {
	const connection = pgp()("postgresql://postgres:postgrespw@localhost:5432/cccat14?schema=public");
	try {
		const accountId = crypto.randomUUID();
		const [account] = await connection.query("select * from account where email = $1", [input.email]);
		if (account) throw new Error("Duplicated account");
		if (isInvalidName(input.name)) throw new Error("Invalid name");
		if (isInvalidEmail(input.email)) throw new Error("Invalid email");
		if (!validateCpf(input.cpf)) throw new Error("Invalid cpf");
		if (input.isDriver && isInvalidCarPlate(input.carPlate)) throw new Error("Invalid car plate");

		await connection.query("insert into account (account_id, name, email, cpf, car_plate, is_passenger, is_driver) values ($1, $2, $3, $4, $5, $6, $7)", [accountId, input.name, input.email, input.cpf, input.carPlate, !!input.isPassenger, !!input.isDriver]);

		return { accountId };

	} finally {
		await connection.$pool.end();
	}
}

function isInvalidName(name: string) {
	return !name.match(/[a-zA-Z] [a-zA-Z]+/)
}

function isInvalidEmail(email: string) {
	return !email.match(/^(.+)@(.+)$/);
}

function isInvalidCarPlate(carPlate: string) {
	return !carPlate.match(/[A-Z]{3}[0-9]{4}/);
}

export async function getAccount(accountId: string) {
	const connection = pgp()("postgresql://postgres:postgrespw@localhost:5432/cccat14?schema=public");
	const [account] = await connection.query("select * from account where account_id = $1", [accountId]);
	await connection.$pool.end();
	return account;
}

export type Ride = {
	id: string,
	passengerId: string,
	riderId: string,
	status: string,
	fare?: number,
	distance: number,
	fromLat: number,
	fromLong: number,
	toLat: number,
	toLong: number,
	date: Date
}

export type Coordinate = {
	lat: number,
	long: number
}

export type Account = {
	id: string,
	name: string,
	email: string,
	cpf: string,
	carPlate: string,
	isPassenger: boolean,
	isDriver: boolean
}

export async function getActiveRideByPassengerId(passengerId: string) {
	const connection = pgp()("postgresql://postgres:postgrespw@localhost:5432/cccat14?schema=public");
	const [ride] = await connection.query("SELECT * FROM ride WHERE passenger_id = $1 AND status <> $2", [passengerId, "COMPLETED"]);
	await connection.$pool.end();
	return ride;
}

export async function getRide(rideId: string): Promise<any> {
	const connection = pgp()("postgresql://postgres:postgrespw@localhost:5432/cccat14?schema=public");
	const [ride] = await connection.query("SELECT * FROM ride WHERE ride_id = $1", [rideId]);
	await connection.$pool.end();
	return ride;
}

export async function requestRide(passengerId: string, from: Coordinate, to: Coordinate): Promise<any> {
	const connection = pgp()("postgresql://postgres:postgrespw@localhost:5432/cccat14?schema=public");
	try {
		const passengerId = crypto.randomUUID();
		const account: any = getAccount(passengerId);
		if (!account) throw new Error("Account not found");
		if (account.isPassenger === false) throw new Error("User is not a passenger");

		const ride = await getActiveRideByPassengerId(passengerId);
		if (ride) throw new Error("Passenger already has an active ride")

	} finally {
		await connection.$pool.end();
	}

	const ride: Ride = {
		id: crypto.randomUUID(),
		passengerId: passengerId,
		riderId: crypto.randomUUID(),
		status: "REQUESTED",
		fare: undefined,
		distance: Math.random(),
		fromLat: from.lat,
		fromLong: from.long,
		toLat: to.lat,
		toLong: to.long,
		date: new Date()
	}

	return ride.id;
}