import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

describe('Physical Twin Service', () => {
  it('GET /api/physical-twin/health should return OK', async () => {
    const res = await request(app)
      .get('/api/physical-twin/health')
      .expect(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.service).toBe('physical-twin');
  });

  it('POST /api/physical-twin/ingest should ingest site capture', async () => {
    const res = await request(app)
      .post('/api/physical-twin/ingest')
      .send({ source: 'drone' })
      .expect(200);
    expect(res.body.message).toBe('Capture ingested successfully');
    expect(res.body.capture.source).toBe('drone');
    expect(res.body.capture.captureId).toBeDefined();
  });

  it('POST /api/physical-twin/ingest with missing source should return 400', async () => {
    await request(app)
      .post('/api/physical-twin/ingest')
      .send({})
      .expect(400);
  });

  it('POST /api/physical-twin/compare should run BIM comparison', async () => {
    const res = await request(app)
      .post('/api/physical-twin/compare')
      .send({
        project_name: 'Test Project',
        quantities: {
          plumbing_fixtures: 10,
          doors_windows: 8,
          drywall_linear_foot: 300
        }
      })
      .expect(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.variances).toBeDefined();
    expect(res.body.variances.doors_windows).toBe(0); // actual 8, target 8 -> diff 0
  });

  it('POST /api/physical-twin/compare with missing quantities should return 400', async () => {
    await request(app)
      .post('/api/physical-twin/compare')
      .send({ project_name: 'Test Project' })
      .expect(400);
  });

  it('GET /api/physical-twin/status should return system status', async () => {
    const res = await request(app)
      .get('/api/physical-twin/status')
      .expect(200);
    expect(res.body.activeCaptures).toBeDefined();
    expect(res.body.bimReference).toBeDefined();
  });

  describe('Firmware Flashing Operations', () => {
    it('POST /api/physical-twin/flash should simulate successful flash', async () => {
      const res = await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM3',
            baudRate: 115200,
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'esp32'
          }
        })
        .expect(200);

      const response = res.body.flashResponse;
      expect(response).toBeDefined();
      expect(response.flashId).toBeDefined();
      expect(response.status).toBe('success');
      expect(response.outputLogs).toContain('Flash completed successfully');
      expect(response.outputLogs).toContain('Booting Creative Liberation Engine on esp32');
    });

    it('POST /api/physical-twin/flash should simulate failed flash on COM_FAIL or failed path', async () => {
      const res = await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM_FAIL',
            baudRate: 115200,
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'esp32'
          }
        })
        .expect(200);

      const response = res.body.flashResponse;
      expect(response.status).toBe('failed');
      expect(response.outputLogs).toContain('Failed to establish serial connection');
    });

    it('POST /api/physical-twin/flash should validate baudRate and chipType', async () => {
      await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM3',
            baudRate: 12345, // invalid
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'esp32'
          }
        })
        .expect(400);

      await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM3',
            baudRate: 115200,
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'invalid_chip' // invalid
          }
        })
        .expect(400);
    });

    it('POST /api/physical-twin/verify-firmware should return verified if pattern matches', async () => {
      // 1. Flash first
      const flashRes = await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM3',
            baudRate: 115200,
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'esp32s3'
          }
        });
      
      const { flashId } = flashRes.body.flashResponse;

      // 2. Verify
      const verifyRes = await request(app)
        .post('/api/physical-twin/verify-firmware')
        .send({
          verifyRequest: {
            flashId,
            expectedFeedbackPattern: 'Booting Creative Liberation Engine'
          }
        })
        .expect(200);

      expect(verifyRes.body.verifyResponse.status).toBe('verified');
      expect(verifyRes.body.verifyResponse.matchedLogs).toContain('Booting Creative Liberation Engine');
    });

    it('POST /api/physical-twin/verify-firmware should return mismatch if pattern is not in logs', async () => {
      const flashRes = await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM3',
            baudRate: 115200,
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'esp32'
          }
        });
      
      const { flashId } = flashRes.body.flashResponse;

      const verifyRes = await request(app)
        .post('/api/physical-twin/verify-firmware')
        .send({
          verifyRequest: {
            flashId,
            expectedFeedbackPattern: 'Some Pattern That Does Not Exist'
          }
        })
        .expect(200);

      expect(verifyRes.body.verifyResponse.status).toBe('mismatch');
    });

    it('POST /api/physical-twin/verify-firmware should return error if flash failed', async () => {
      const flashRes = await request(app)
        .post('/api/physical-twin/flash')
        .send({
          flashRequest: {
            devicePort: 'COM_FAIL',
            baudRate: 115200,
            firmwareBinaryPath: '/build/firmware.bin',
            chipType: 'esp32'
          }
        });
      
      const { flashId } = flashRes.body.flashResponse;

      const verifyRes = await request(app)
        .post('/api/physical-twin/verify-firmware')
        .send({
          verifyRequest: {
            flashId,
            expectedFeedbackPattern: 'Booting Creative Liberation Engine'
          }
        })
        .expect(200);

      expect(verifyRes.body.verifyResponse.status).toBe('error');
      expect(verifyRes.body.verifyResponse.matchedLogs).toContain('Flashing failed prior to verification');
    });

    it('POST /api/physical-twin/verify-firmware should return 404 for unknown flashId', async () => {
      await request(app)
        .post('/api/physical-twin/verify-firmware')
        .send({
          verifyRequest: {
            flashId: '00000000-0000-0000-0000-000000000000',
            expectedFeedbackPattern: 'Booting'
          }
        })
        .expect(404);
    });
  });
});
