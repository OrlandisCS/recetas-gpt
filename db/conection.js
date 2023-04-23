import { connect } from 'mongoose';

const dbConection = async () => {
	try {
		await connect(process.env.DATABASEURL);
		console.log('DB conectada...');
	} catch (error) {
		console.log(error);
		throw new Error('Error al conectar la base de datos');
	}
};

export { dbConection };
