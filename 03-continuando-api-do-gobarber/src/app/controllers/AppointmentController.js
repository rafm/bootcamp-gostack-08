import * as Yup from 'yup';
import { startOfHour, isBefore, format } from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';

class AppointmentController {
    async index(request, response) {
        let { page = 1 } = request.query;
        if (page < 1) {
            page = 1;
        }

        const appointments = await Appointment.findAll({
            where: {
                user_id: request.userId,
                canceled_at: null,
            },
            offset: (page - 1) * 20,
            limit: 20,
            order: ['date'],
            attributes: ['id', 'date'],
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'path', 'url'],
                        },
                    ],
                },
            ],
        });

        return response.json(appointments);
    }

    async store(request, response) {
        const schema = Yup.object().shape({
            date: Yup.date().required(),
            provider_id: Yup.number()
                .integer()
                .required(),
        });

        if (!(await schema.isValid(request.body))) {
            return response.status(400).json({ error: 'Validation fails' });
        }

        const { date, provider_id } = schema.cast(request.body);

        /**
         * Check if request user is the user provider
         */
        if (request.userId === provider_id) {
            return response
                .status(400)
                .json({ error: 'Can not create an appointment with yourself' });
        }

        /**
         * check if provider_id is a provider
         */
        const checkIsProvider = await User.findOne({
            where: { id: provider_id, provider: true },
        });
        if (!checkIsProvider) {
            return response.status(401).json({
                error: 'You can only create appointments with providers',
            });
        }

        /**
         * Check for past dates
         */
        const hourStart = startOfHour(date);
        if (isBefore(hourStart, new Date())) {
            return response
                .status(400)
                .json({ error: 'Past dates are not permitted' });
        }

        /**
         * Check date availability
         */
        const checkAvailability = await Appointment.findOne({
            where: {
                date: hourStart,
                provider_id,
                canceled_at: null,
            },
        });
        if (checkAvailability) {
            return response
                .status(400)
                .json({ error: 'Appointment date is not available' });
        }

        const appointment = await Appointment.create({
            date: hourStart,
            user_id: request.userId,
            provider_id,
        });

        /**
         * Notify appointment provider
         */
        const user = await User.findByPk(request.userId);
        const formattedDate = format(
            hourStart,
            "'dia' dd 'de' MMMM', às' H:mm'h'",
            { locale: pt }
        );
        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formattedDate}`,
            user: provider_id,
        });

        return response.json(appointment);
    }
}

export default new AppointmentController();
