import User from "../models/users.js";
import { Op } from "sequelize";
import { sendVerificationEmail } from '../email.js';

async function generateID(id) {
	const { count } = await findAndCountAllUsersById(id);
	if (count > 0) {
		id = id.substring(0, 5);
		const { count } = await findAndCountAllUsersById(id);
		id = id + (count + 1);
	}
	return id;
}

export async function getUsers() {
	return await User.findAll();
}
export async function getUserById(id) {
	return await User.findByPk(id);
}
export async function findAndCountAllUsersById(id) {
	return await User.findAndCountAll({
		where: {
			id: {
				[Op.like]: `${id}%`,
			},
		},
	});
}
export async function findAndCountAllUsersByEmail(email) {
	return await User.findAndCountAll({
		where: {
			email: {
				[Op.eq]: email,
			},
		},
	});
}
export async function findAndCountAllUsersByUsername(username) {
	return await User.findAndCountAll({
		where: {
			username: {
				[Op.eq]: username,
			},
		},
	});
}
export async function registerUser(userDatas, bcrypt) {
	try {
		if (!userDatas) {
			return { error: "Aucune donnée à enregistrer" };
		}
		const { firstname, lastname, username, email, password } = userDatas;
		if (!firstname || !lastname || !username || !email || !password) {
			return { error: "Tous les champs sont obligatoires" };
		}
		
		const { count: emailCount } = await findAndCountAllUsersByEmail(email);
		if (emailCount > 0) {
			return { error: "L'adresse email est déjà utilisée." };
		}
		
		const { count: usernameCount } = await findAndCountAllUsersByUsername(username);
		if (usernameCount > 0) {
			return { error: "Le nom d'utilisateur est déjà utilisé." };
		}

		if (usernameCount > 0) {
			return { error: "Le nom d'utilisateur est déjà utilisé." };
		}

		let id = await generateID(
			(lastname.substring(0, 3) + firstname.substring(0, 3)).toUpperCase()
		);

		const hashedPassword = await bcrypt.hash(password);
		
		const user = {
			id,
			firstname,
			lastname,
			username,
			email,
			password: hashedPassword,
			verified: false
		};

		const newUser = await User.create(user);

		try {
			await sendVerificationEmail(
				user.id, 
				email, 
				'Vérification de votre compte Morris Game'
			);
			return {
				success: true,
				message: "Inscription réussie. Veuillez vérifier votre email.",
				userId: user.id
			};
		} catch (emailError) {
			// Si l'envoi d'email échoue, on supprime l'utilisateur créé
			await user.destroy();
			return { 
				error: "Erreur lors de l'envoi de l'email de vérification. Veuillez réessayer." 
			};
		}

	} catch (error) {
		console.error('Registration error:', error);
		return { 
			error: "Une erreur est survenue lors de l'inscription. Veuillez réessayer." 
		};
	}
}

export async function loginUser(userDatas, app) {
	if (!userDatas) {
		return { error: "Aucune donnée n'a été envoyée" };
	}
	const { email, password } = userDatas;
	if (!email || !password) {
		return { error: "Tous les champs sont obligatoires" };
	}
	
	const { count, rows } = await findAndCountAllUsersByEmail(email);
	if (count === 0) {
		return {
			error: "Il n'y a pas d'utilisateur associé à cette adresse email.",
		};
	} else if (rows[0].verified === false) {
		return {
			error: "Votre compte n'est pas encore vérifié. Veuillez vérifier votre boîte mail.",
		};
	}
	
	const user = await User.findOne({
		where: {
			email: {
				[Op.eq]: email,
			},
		},
	});
	
	const match = await app.bcrypt.compare(password, user.password);
	if (!match) {
		return { error: "Mot de passe incorrect" };
	}
	
	const token = app.jwt.sign(
			{ 
				id: user.id, 
				username: user.username
			},
			{ expiresIn: "3h" }
		);
	return { token, id: user.id, username: user.username };
}
