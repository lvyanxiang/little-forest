import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('bookings')
@Index(['visitDate', 'slotId', 'status'])
@Index(['clientId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @Column({ length: 10 })
  visitDate: string;

  @Column()
  slotId: number;

  @Column()
  slotLabel: string;

  @Column({ length: 5 })
  startTime: string;

  @Column({ length: 5 })
  endTime: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column({ default: 1 })
  people: number;

  @Column({ default: 'confirmed' })
  status: 'confirmed' | 'cancelled';

  @CreateDateColumn()
  createdAt: Date;
}
