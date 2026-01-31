// =============================================================
// src/services/donationService.ts
// =============================================================

import pool from '../config/database';
import { RowDataPacket } from 'mysql2';
import {
  Donation,
  CreateDonationDTO,
  DonationTypeName,
} from '../types';
import { ApiError } from '../utils/response';
import { generateReceiptNumber } from '../utils/helpers';
import { CommissionService } from './commissionService';

export class DonationService {

  /**
   * Record a new donation.
   * - For RICE_GRAIN: calculates monetary amount = quantity_kg × market_rate
   * - For CUSTOM: commission is NOT applicable
   * - Automatically triggers commission calculation for AMOUNT & RICE_GRAIN
   */
  static async create(dto: CreateDonationDTO): Promise<Donation> {
    // Resolve donation_type_id
    const [typeRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM donation_types WHERE name = ?', [dto.donation_type],
    );
    const typeRowsCast = typeRows as { id: number; name: string }[];
    if (!typeRowsCast[0]) throw new ApiError('Invalid donation type.', 400);
    const donationTypeId = typeRowsCast[0].id;

    let amount = dto.amount ?? null;
    let isCommissionApplicable = true;

    if (dto.donation_type === 'RICE_GRAIN') {
      if (!dto.quantity_kg || !dto.market_rate) {
        throw new ApiError('quantity_kg and market_rate are required for RICE_GRAIN donations.', 400);
      }
      if (dto.quantity_kg < 1) {
        // Commission only on ≥ 1 KG; still record the donation
        isCommissionApplicable = false;
      }
      amount = parseFloat((dto.quantity_kg * dto.market_rate).toFixed(2));
    }

    if (dto.donation_type === 'AMOUNT') {
      if (!amount || amount <= 0) {
        throw new ApiError('amount must be positive for AMOUNT donations.', 400);
      }
    }

    if (dto.donation_type === 'CUSTOM') {
      isCommissionApplicable = false;
    }

    const receipt = generateReceiptNumber();

    const [res] = await pool.execute(
      `INSERT INTO donations
       (contributor_id, volunteer_id, donation_type_id,
        amount, quantity_kg, market_rate, custom_description,
        payment_method, receipt_number, is_commission_applicable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.contributor_id,
        dto.volunteer_id,
        donationTypeId,
        amount,
        dto.quantity_kg ?? null,
        dto.market_rate ?? null,
        dto.custom_description ?? null,
        dto.payment_method ?? null,
        receipt,
        isCommissionApplicable ? 1 : 0,
      ],
    );

    const donationId = (res as { insertId: number }).insertId;
    const donation = (await DonationService.findById(donationId))!;

    // Auto-trigger commission for eligible donations (Field Workers)
    if (isCommissionApplicable && amount && amount > 0) {
      await CommissionService.calculateForDonation(donation);
    }

    return donation;
  }

  static async findById(id: number): Promise<Donation | null> {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM donations WHERE id = ?', [id]);
    return (rows as Donation[])[0] ?? null;
  }

  /** All donations made by a contributor */
  static async findByContributor(contributorId: number): Promise<Donation[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM donations WHERE contributor_id = ? ORDER BY created_at DESC',
      [contributorId],
    );
    return rows as Donation[];
  }

  /** All donations collected by a volunteer */
  static async findByVolunteer(volunteerId: number): Promise<Donation[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM donations WHERE volunteer_id = ? ORDER BY created_at DESC',
      [volunteerId],
    );
    return rows as Donation[];
  }

  /** Donation type name resolver */
  static async getTypeName(typeId: number): Promise<DonationTypeName | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT name FROM donation_types WHERE id = ?', [typeId],
    );
    return (rows as { name: DonationTypeName }[])[0]?.name ?? null;
  }
}
