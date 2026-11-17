import { describe, expect, it } from 'vitest';
import { doctorImage } from '../src/consult/doctors';
import { resolveImageUrl } from '../src/home/catalog';
import { consultationDoctorPhoto } from '../src/components/consult/ConsultationCard';
import { mapAppointment } from '../src/profile/map';
import { BaseUrl } from '../src/config/key';

const apiBase = String(BaseUrl.base_url || '').replace(/\/$/, '');

describe('doctor photo resolution', () => {
  it('reads doctor.doctor_image from a consultation-history row', () => {
    const live = 'https://ayurmuni-media.s3.amazonaws.com/doctors/akash.png';
    const row = {
      consultation_id: 'C1',
      appointment_status: 'confirmed',
      appointment_date: '2026-11-19',
      start_time: '18:01',
      doctor: {
        id: 11,
        doctor_name: 'Dr. (Prof.) Akash Saxena',
        doctor_image: live,
        qualification: 'MD',
        is_dietitian: true,
      },
    };
    expect(doctorImage(row.doctor)).toBe(live);
    expect(consultationDoctorPhoto(mapAppointment(row))).toBe(live);
    expect(mapAppointment(row).image).toBe(live);
  });

  it('absolutizes a relative doctor_image with the API base', () => {
    const rel = '/media/doctors/akash.png';
    const expected = `${apiBase}/media/doctors/akash.png`;
    expect(resolveImageUrl({ doctor_image: rel })).toBe(expected);
    expect(doctorImage({ doctor_image: rel })).toBe(expected);
  });

  it('reads object media fields and nested doctor', () => {
    const live = 'https://ayurmuni-media.s3.amazonaws.com/doctors/akash.png';
    expect(doctorImage({ doctor_image: { media_url: live } })).toBe(live);
    expect(doctorImage({ doctor: { doctor_image: live } })).toBe(live);
    expect(consultationDoctorPhoto({ raw: { doctor: { profile_image: live } } })).toBe(live);
  });
});
