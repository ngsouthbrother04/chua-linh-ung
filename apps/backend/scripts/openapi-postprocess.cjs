const fs = require('fs');
const path = require('path');

const OPENAPI_PATH = path.resolve(process.cwd(), 'openapi.json');
const OPENAPI_ENFORCE_MAPPING = process.env.OPENAPI_ENFORCE_MAPPING !== 'false';

function getTagByPath(apiPath) {
  if (apiPath.startsWith('/api/v1/auth')) return 'Auth';
  if (apiPath.startsWith('/api/v1/sync')) return 'Sync';
  if (apiPath.startsWith('/api/v1/admin')) return 'Admin';
  if (apiPath.startsWith('/api/v1/pois')) return 'POIs';
  if (apiPath.startsWith('/api/v1/tours')) return 'Tours';
  if (apiPath.startsWith('/api/v1/analytics')) return 'Analytics';
  return 'System';
}

function requiresBearer(apiPath) {
  if (apiPath.startsWith('/api/v1/sync')) return true;
  if (apiPath.startsWith('/api/v1/pois')) return true;
  if (apiPath.startsWith('/api/v1/tours')) return true;
  if (apiPath.startsWith('/api/v1/analytics')) return true;

  if (apiPath.startsWith('/api/v1/auth')) {
    return [
      '/api/v1/auth/payment/claim',
      '/api/v1/auth/payment/initiate',
      '/api/v1/auth/logout'
    ].includes(apiPath);
  }

  return false;
}

function requiresAdminBearer(apiPath) {
  return apiPath.startsWith('/api/v1/admin');
}

function ensureErrorResponse(operation, statusCode, description) {
  operation.responses = operation.responses || {};
  if (!operation.responses[statusCode]) {
    operation.responses[statusCode] = {
      description,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' }
        }
      }
    };
  }
}

function setJsonResponse(operation, statusCode, description, schemaRef) {
  operation.responses = operation.responses || {};
  operation.responses[statusCode] = {
    description,
    content: {
      'application/json': {
        schema: { $ref: schemaRef }
      }
    }
  };
}

function normalizeTrailingSlashPaths(doc) {
  const paths = doc.paths || {};
  const merged = {};

  for (const [apiPath, pathItem] of Object.entries(paths)) {
    const normalizedPath = apiPath !== '/' && apiPath.endsWith('/') ? apiPath.slice(0, -1) : apiPath;

    if (!merged[normalizedPath]) {
      merged[normalizedPath] = {};
    }

    Object.assign(merged[normalizedPath], pathItem);
  }

  doc.paths = merged;
}

function buildOverrides() {
  return {
    'GET /': {
      summary: 'Health check',
      description: 'Check backend availability and database connectivity.'
    },

    'POST /api/v1/auth/register': {
      summary: 'Register account',
      description: 'Create a new account with email and password.',
      responseSchemas: { '201': '#/components/schemas/AuthSessionResponse' }
    },
    'POST /api/v1/auth/login': {
      summary: 'Login account',
      description: 'Authenticate user and return auth tokens.',
      responseSchemas: { '200': '#/components/schemas/AuthSessionResponse' }
    },
    'POST /api/v1/auth/payment/claim': {
      summary: 'Redeem claim code',
      description: 'Redeem access code for authenticated user.',
      responseSchemas: { '200': '#/components/schemas/AuthSessionResponse' }
    },
    'POST /api/v1/auth/token-refresh': {
      summary: 'Refresh access token',
      description: 'Refresh auth session by refresh token.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AuthRefreshResponse' }
    },
    'POST /api/v1/auth/payment/initiate': {
      summary: 'Initiate payment',
      description: 'Create payment transaction for authenticated user.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['amount'],
              properties: {
                paymentMethod: { type: 'string', enum: ['vnpay', 'momo'] },
                provider: { type: 'string', enum: ['vnpay', 'momo'] },
                amount: { type: 'number' },
                currency: { type: 'string', default: 'VND' },
                deviceId: { type: 'string' },
                returnUrl: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/PaymentInitiateResponse' }
    },
    'POST /api/v1/auth/logout': {
      summary: 'Logout session',
      description: 'Revoke current access token from header or request body.',
      responseSchemas: { '200': '#/components/schemas/LogoutResponse' }
    },
    'POST /api/v1/auth/payment/callback': {
      summary: 'Handle payment callback',
      description: 'Validate callback signature and finalize payment status.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                orderId: { type: 'string' },
                transactionId: { type: 'string' },
                status: { type: 'string', enum: ['success', 'failed', 'cancelled', 'succeeded', 'fail', 'canceled'] },
                provider: { type: 'string', enum: ['vnpay', 'momo'] },
                gatewayPayload: { type: 'object' },
                deviceId: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/PaymentCallbackResponse' }
    },

    'GET /api/v1/sync/manifest': {
      summary: 'Get sync manifest',
      description: 'Return current content version and sync metadata.',
      responseSchemas: { '200': '#/components/schemas/SyncManifestResponse' }
    },
    'GET /api/v1/sync/full': {
      summary: 'Get full sync payload',
      description: 'Return full POI and tour data for bootstrap or fallback sync.',
      parameters: [{ name: 'version', in: 'query', schema: { type: 'integer' } }],
      responseSchemas: { '200': '#/components/schemas/SyncFullResponse' }
    },
    'POST /api/v1/sync/incremental': {
      summary: 'Get incremental sync payload',
      description: 'Return delta changes from a client content version.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fromVersion'],
              properties: {
                fromVersion: { type: 'integer' }
              }
            }
          }
        }
      },
      responseSchemas: {
        '200': '#/components/schemas/SyncIncrementalSuccessResponse',
        '409': '#/components/schemas/SyncIncrementalConflictResponse'
      }
    },

    'POST /api/v1/admin/pois/:id/audio/generate': {
      summary: 'Queue POI TTS generation',
      description: 'Enqueue server-side TTS jobs for a POI.',
      responses: { '202': { description: 'Accepted' } },
      responseSchemas: { '202': '#/components/schemas/AdminAudioGenerateResponse' }
    },
    'POST /api/v1/admin/pois/:id/image/upload': {
      summary: 'Upload POI image',
      description: 'Upload image file for a POI.',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AdminPoiImageUploadResponse' }
    },
    'POST /api/v1/admin/tours/:id/image/upload': {
      summary: 'Upload tour image',
      description: 'Upload image file for a tour.',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['image'],
              properties: {
                image: { type: 'string', format: 'binary' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AdminTourImageUploadResponse' }
    },
    'POST /api/v1/admin/pois': {
      summary: 'Create POI',
      description: 'Create POI record from CMS payload.',
      responseSchemas: { '201': '#/components/schemas/AdminPoiMutationResponse' }
    },
    'GET /api/v1/admin/pois': {
      summary: 'List POIs for admin',
      description: 'List POIs including unpublished records for CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminPoiListResponse' }
    },
    'POST /api/v1/admin/pois/:id/publish': {
      summary: 'Publish POI',
      description: 'Publish POI and trigger TTS queue.',
      responseSchemas: { '200': '#/components/schemas/AdminPoiPublishResponse' }
    },
    'GET /api/v1/admin/pois/:id': {
      summary: 'Get POI detail for admin',
      description: 'Retrieve POI by id for CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminPoiRecord' }
    },
    'PUT /api/v1/admin/pois/:id': {
      summary: 'Update POI',
      description: 'Update POI fields for CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminPoiMutationResponse' }
    },
    'DELETE /api/v1/admin/pois/:id': {
      summary: 'Delete POI',
      description: 'Soft delete POI from CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminPoiMutationResponse' }
    },
    'POST /api/v1/admin/tours': {
      summary: 'Create tour',
      description: 'Create tour with ordered POI sequence.',
      responseSchemas: { '201': '#/components/schemas/AdminTourMutationResponse' }
    },
    'GET /api/v1/admin/tours/:id': {
      summary: 'Get tour detail for admin',
      description: 'Retrieve tour by id for CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminTourRecord' }
    },
    'PUT /api/v1/admin/tours/:id': {
      summary: 'Update tour',
      description: 'Update tour fields for CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminTourMutationResponse' }
    },
    'DELETE /api/v1/admin/tours/:id': {
      summary: 'Delete tour',
      description: 'Soft delete tour from CMS.',
      responseSchemas: { '200': '#/components/schemas/AdminTourMutationResponse' }
    },
    'POST /api/v1/admin/maintenance/pois/soft-delete-cleanup': {
      summary: 'Run POI retention cleanup',
      description: 'Run dry-run or execute soft-delete retention cleanup.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                dryRun: { type: 'boolean' },
                reason: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AdminRetentionCleanupResponse' }
    },
    'POST /api/v1/admin/sync/invalidate': {
      summary: 'Invalidate sync manifest',
      description: 'Force clients to refresh sync metadata.',
      responseSchemas: { '200': '#/components/schemas/AdminSyncInvalidateResponse' }
    },
    'GET /api/v1/admin/tts/queue/status': {
      summary: 'Get TTS queue status',
      description: 'Return queue counts and worker status.',
      responseSchemas: { '200': '#/components/schemas/AdminTtsQueueStatusResponse' }
    },
    'GET /api/v1/admin/tts/config/validate': {
      summary: 'Validate TTS config',
      description: 'Validate runtime TTS configuration.',
      responseSchemas: { '200': '#/components/schemas/AdminTtsConfigValidationResponse' }
    },
    'GET /api/v1/admin/users': {
      summary: 'List users for admin',
      description: 'Retrieve users and optionally filter by role.',
      parameters: [
        {
          name: 'role',
          in: 'query',
          schema: { type: 'string', enum: ['USER', 'PARTNER', 'ADMIN'] }
        }
      ],
      responseSchemas: { '200': '#/components/schemas/AdminUserListResponse' }
    },
    'POST /api/v1/admin/users/:id/role': {
      summary: 'Assign user role',
      description: 'Assign USER/PARTNER/ADMIN role for target user.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['role'],
              properties: {
                role: { type: 'string', enum: ['USER', 'PARTNER', 'ADMIN'] },
                reason: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AdminUserRoleMutationResponse' }
    },
    'POST /api/v1/admin/users/:id/role/revoke': {
      summary: 'Revoke elevated role',
      description: 'Downgrade target user role to USER.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                reason: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AdminUserRoleMutationResponse' }
    },

    'GET /api/v1/pois': {
      summary: 'List POIs',
      description: 'Get paginated POI list for user subscription.',
      responseSchemas: { '200': '#/components/schemas/PublicPoiListResponse' }
    },
    'GET /api/v1/pois/:id': {
      summary: 'Get POI detail',
      description: 'Get POI detail by id for user subscription.',
      responseSchemas: { '200': '#/components/schemas/PublicPoiDetailResponse' }
    },
    'POST /api/v1/pois/search/radius': {
      summary: 'Search POIs by radius',
      description: 'Search nearby POIs using latitude, longitude, and radius.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['latitude', 'longitude', 'radiusM'],
              properties: {
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                radiusM: { type: 'number' },
                limit: { type: 'integer', default: 20 }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/PoiRadiusSearchResponse' }
    },
    'GET /api/v1/tours': {
      summary: 'List tours',
      description: 'Get paginated tour list for user subscription.',
      responseSchemas: { '200': '#/components/schemas/PublicTourListResponse' }
    },
    'GET /api/v1/tours/:id': {
      summary: 'Get tour detail',
      description: 'Get tour detail by id for user subscription.',
      responseSchemas: { '200': '#/components/schemas/PublicTourDetailResponse' }
    },

    'POST /api/v1/analytics/events': {
      summary: 'Upload analytics events',
      description: 'Upload analytics events in batch.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['events'],
              properties: {
                events: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      deviceId: { type: 'string' },
                      sessionId: { type: 'string' },
                      poiId: { type: 'string' },
                      action: { type: 'string' },
                      durationMs: { type: 'integer' },
                      language: { type: 'string' },
                      timestamp: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/AnalyticsEventsResponse' }
    },
    'POST /api/v1/analytics/presence/heartbeat': {
      summary: 'Send presence heartbeat',
      description: 'Update online and active user windows by heartbeat.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['deviceId', 'sessionId', 'timestamp'],
              properties: {
                deviceId: { type: 'string' },
                sessionId: { type: 'string' },
                appState: { type: 'string' },
                audioState: { type: 'string' },
                timestamp: { type: 'integer' },
                language: { type: 'string' }
              }
            }
          }
        }
      },
      responseSchemas: { '200': '#/components/schemas/PresenceHeartbeatResponse' }
    },
    'GET /api/v1/analytics/stats': {
      summary: 'Get analytics stats',
      description: 'Get analytics summary metrics.',
      responseSchemas: { '200': '#/components/schemas/AnalyticsStatsResponse' }
    }
  };
}

function applyOperationOverrides(apiPath, method, operation, overrides) {
  const key = `${method.toUpperCase()} ${apiPath}`;
  let routeKey = key;

  if (!overrides[routeKey]) {
    routeKey = routeKey.replace(/\/{[^}]+}/g, '/:id');
  }

  const override = overrides[routeKey];
  if (!override) {
    return null;
  }

  if (override.summary) {
    operation.summary = override.summary;
  }

  if (override.description) {
    operation.description = override.description;
  }

  if (override.parameters) {
    const existingHeaders = (operation.parameters || []).filter((parameter) => parameter.in === 'header');
    operation.parameters = [...override.parameters, ...existingHeaders];
  }

  if (override.requestBody) {
    operation.requestBody = override.requestBody;
  }

  if (override.responses) {
    operation.responses = {
      ...operation.responses,
      ...override.responses
    };
  }

  if (override.responseSchemas) {
    for (const [statusCode, schemaRef] of Object.entries(override.responseSchemas)) {
      const description = operation.responses?.[statusCode]?.description || (statusCode === '200' ? 'OK' : 'Response');
      setJsonResponse(operation, statusCode, description, schemaRef);
    }
  }

  return routeKey;
}

function main() {
  if (!fs.existsSync(OPENAPI_PATH)) {
    console.error('openapi.json not found. Run: npm run openapi:generate');
    process.exit(1);
  }

  const doc = JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf8'));
  const overrides = buildOverrides();

  normalizeTrailingSlashPaths(doc);
  delete doc.paths['/api-docs/swagger.json'];

  doc.tags = [
    { name: 'Auth' },
    { name: 'Sync' },
    { name: 'POIs' },
    { name: 'Tours' },
    { name: 'Analytics' },
    { name: 'Admin' },
    { name: 'System' }
  ];

  doc.components = doc.components || {};
  doc.components.schemas = doc.components.schemas || {};

  doc.components.schemas.ErrorResponse = {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'error' },
      error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Validation failed' }
        }
      }
    }
  };

  doc.components.schemas.LanguageMap = {
    type: 'object',
    additionalProperties: { type: 'string' }
  };

  doc.components.schemas.Pagination = {
    type: 'object',
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer' }
    }
  };

  doc.components.schemas.PublicPoiItem = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { $ref: '#/components/schemas/LanguageMap' },
      description: { $ref: '#/components/schemas/LanguageMap' },
      audioUrls: { $ref: '#/components/schemas/LanguageMap' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      type: { type: 'string' },
      image: { type: 'string', nullable: true }
    }
  };

  doc.components.schemas.PublicTourItem = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { $ref: '#/components/schemas/LanguageMap' },
      description: { $ref: '#/components/schemas/LanguageMap' },
      duration: { type: 'integer' },
      poiIds: { type: 'array', items: { type: 'string' } },
      image: { type: 'string', nullable: true }
    }
  };

  doc.components.schemas.PublicPoiListResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/PublicPoiItem' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        }
      }
    }
  };

  doc.components.schemas.PublicPoiDetailResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      data: { $ref: '#/components/schemas/PublicPoiItem' }
    }
  };

  doc.components.schemas.PublicTourListResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/PublicTourItem' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        }
      }
    }
  };

  doc.components.schemas.PublicTourDetailResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      data: { $ref: '#/components/schemas/PublicTourItem' }
    }
  };

  doc.components.schemas.AuthSessionResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      token: { type: 'string' },
      refreshToken: { type: 'string' },
      expiresIn: { type: 'number' },
      user: { type: 'object' }
    }
  };

  doc.components.schemas.AuthRefreshResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      token: { type: 'string' },
      refreshToken: { type: 'string' },
      expiresIn: { type: 'number' }
    }
  };

  doc.components.schemas.PaymentInitiateResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      transactionId: { type: 'string' },
      provider: { type: 'string' },
      amount: { type: 'number' },
      currency: { type: 'string' },
      paymentUrl: { type: 'string' },
      expiresAt: { type: 'string', format: 'date-time' }
    }
  };

  doc.components.schemas.LogoutResponse = {
    type: 'object',
    properties: { message: { type: 'string' } }
  };

  doc.components.schemas.PaymentCallbackResponse = {
    type: 'object',
    properties: {
      token: { type: 'string' },
      expiresIn: { type: 'number' },
      deviceId: { type: 'string' },
      orderId: { type: 'string' },
      status: { type: 'string' }
    }
  };

  doc.components.schemas.SyncManifestResponse = {
    type: 'object',
    properties: {
      contentVersion: { type: 'integer' },
      totalPois: { type: 'integer' },
      totalTours: { type: 'integer' },
      lastUpdatedAt: { type: 'string', format: 'date-time' },
      checksum: { type: 'string' }
    }
  };

  doc.components.schemas.SyncFullResponse = {
    type: 'object',
    properties: {
      contentVersion: { type: 'integer' },
      needsSync: { type: 'boolean' },
      pois: { type: 'array', items: { $ref: '#/components/schemas/PublicPoiItem' } },
      tours: { type: 'array', items: { $ref: '#/components/schemas/PublicTourItem' } }
    }
  };

  doc.components.schemas.SyncIncrementalSuccessResponse = {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'success' },
      data: { type: 'object' }
    }
  };

  doc.components.schemas.SyncIncrementalConflictResponse = {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'error' },
      error: { type: 'object' },
      data: { type: 'object' }
    }
  };

  doc.components.schemas.AdminPoiRecord = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { $ref: '#/components/schemas/LanguageMap' },
      description: { $ref: '#/components/schemas/LanguageMap' },
      audioUrls: { $ref: '#/components/schemas/LanguageMap' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      type: { type: 'string' },
      image: { type: 'string', nullable: true },
      isPublished: { type: 'boolean' },
      publishedAt: { type: 'string', format: 'date-time', nullable: true },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
      contentVersion: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  };

  doc.components.schemas.AdminTourRecord = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { $ref: '#/components/schemas/LanguageMap' },
      description: { $ref: '#/components/schemas/LanguageMap' },
      duration: { type: 'integer' },
      poiIds: { type: 'array', items: { type: 'string' } },
      image: { type: 'string', nullable: true },
      isPublished: { type: 'boolean' },
      publishedAt: { type: 'string', format: 'date-time', nullable: true },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
      contentVersion: { type: 'integer' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  };

  doc.components.schemas.AdminPoiMutationResponse = {
    type: 'object',
    allOf: [
      { type: 'object', properties: { message: { type: 'string' } } },
      { $ref: '#/components/schemas/AdminPoiRecord' }
    ]
  };

  doc.components.schemas.AdminTourMutationResponse = {
    type: 'object',
    allOf: [
      { type: 'object', properties: { message: { type: 'string' } } },
      { $ref: '#/components/schemas/AdminTourRecord' }
    ]
  };

  doc.components.schemas.AdminPoiListResponse = {
    type: 'object',
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/AdminPoiRecord' } },
      total: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminPoiPublishResponse = {
    type: 'object',
    allOf: [
      { type: 'object', properties: { message: { type: 'string' }, syncVersion: { type: 'integer' }, ttsQueued: { type: 'integer' } } },
      { $ref: '#/components/schemas/AdminPoiRecord' }
    ]
  };

  doc.components.schemas.AdminAudioGenerateResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      poiId: { type: 'string' },
      queued: { type: 'integer' },
      skipped: { type: 'integer' },
      jobIds: { type: 'array', items: { type: 'string' } },
      mode: { type: 'string', enum: ['bullmq', 'in-memory'] }
    }
  };

  doc.components.schemas.AdminPoiImageUploadResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      poiId: { type: 'string' },
      imageUrl: { type: 'string' },
      contentVersion: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminTourImageUploadResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      tourId: { type: 'string' },
      imageUrl: { type: 'string' },
      contentVersion: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminRetentionCleanupResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      dryRun: { type: 'boolean' },
      retentionDays: { type: 'integer' },
      cutoffAt: { type: 'string', format: 'date-time' },
      scanned: { type: 'integer' },
      purged: { type: 'integer' },
      deletedIds: { type: 'array', items: { type: 'string' } },
      audioFilesRemoved: { type: 'integer' },
      imagesRemoved: { type: 'integer' },
      imageCleanupFailed: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminSyncInvalidateResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      invalidated: { type: 'boolean' },
      syncVersion: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminTtsQueueStatusResponse = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['bullmq', 'in-memory'] },
      waiting: { type: 'integer' },
      active: { type: 'integer' },
      completed: { type: 'integer' },
      failed: { type: 'integer' },
      delayed: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminTtsConfigValidationResponse = {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      queueMode: { type: 'string', enum: ['bullmq', 'in-memory'] },
      storageProvider: { type: 'string', enum: ['local'] },
      errors: { type: 'array', items: { type: 'string' } },
      warnings: { type: 'array', items: { type: 'string' } }
    }
  };

  doc.components.schemas.AdminUserListItem = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
      fullName: { type: 'string', nullable: true },
      role: { type: 'string', enum: ['USER', 'PARTNER', 'ADMIN'] },
      isActive: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  };

  doc.components.schemas.AdminUserListResponse = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/AdminUserListItem' }
      },
      total: { type: 'integer' }
    }
  };

  doc.components.schemas.AdminUserRoleMutationResponse = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      id: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string', enum: ['USER', 'PARTNER', 'ADMIN'] },
      previousRole: { type: 'string', enum: ['USER', 'PARTNER', 'ADMIN'] },
      reason: { type: 'string', nullable: true },
      reauthRequired: { type: 'boolean' }
    }
  };

  doc.components.schemas.PoiRadiusSearchResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      items: { type: 'array', items: { $ref: '#/components/schemas/PublicPoiItem' } },
      meta: {
        type: 'object',
        properties: {
          radiusM: { type: 'number' },
          center: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' }
            }
          }
        }
      }
    }
  };

  doc.components.schemas.AnalyticsEventsResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      processedCount: { type: 'integer' },
      failedCount: { type: 'integer' }
    }
  };

  doc.components.schemas.PresenceHeartbeatResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      onlineNowWindowSec: { type: 'integer' },
      active5mWindowSec: { type: 'integer' }
    }
  };

  doc.components.schemas.AnalyticsStatsResponse = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          plays: { type: 'integer' },
          qrScans: { type: 'integer' },
          topPois: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                poiId: { type: 'string' },
                playCount: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  };

  const unmappedOperations = [];

  for (const [apiPath, pathItem] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (typeof operation !== 'object' || !operation) {
        continue;
      }

      operation.tags = [getTagByPath(apiPath)];

      if (requiresAdminBearer(apiPath)) {
        operation.security = [{ bearerAuth: [] }];
        ensureErrorResponse(operation, '403', 'Forbidden');
      } else if (requiresBearer(apiPath)) {
        operation.security = [{ bearerAuth: [] }];
        ensureErrorResponse(operation, '401', 'Unauthorized');
      } else {
        operation.security = [];
      }

      if (apiPath !== '/') {
        ensureErrorResponse(operation, '500', 'Internal Server Error');
      }

      if (!operation.operationId) {
        const cleanPath = apiPath
          .replace(/^\/+/, '')
          .replace(/[{}]/g, '')
          .replace(/\//g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '_');
        operation.operationId = `${method}_${cleanPath}`;
      }

      const mappedKey = applyOperationOverrides(apiPath, method, operation, overrides);
      if (!mappedKey && apiPath.startsWith('/api/v1/')) {
        unmappedOperations.push(`${method.toUpperCase()} ${apiPath}`);
      }

      if (!operation.summary) {
        operation.summary = `${method.toUpperCase()} ${apiPath}`;
      }

      if (!operation.description) {
        operation.description = `Endpoint ${method.toUpperCase()} ${apiPath}`;
      }
    }
  }

  if (unmappedOperations.length > 0) {
    const lines = ['OpenAPI postprocess: unmapped operations detected:'];
    for (const operationKey of unmappedOperations) {
      lines.push(` - ${operationKey}`);
    }

    if (OPENAPI_ENFORCE_MAPPING) {
      console.error(lines.join('\n'));
      process.exit(1);
    }

    console.warn(lines.join('\n'));
  }

  fs.writeFileSync(OPENAPI_PATH, JSON.stringify(doc, null, 2));
  console.log('OpenAPI postprocess completed');
}

main();
