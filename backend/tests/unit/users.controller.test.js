import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// MOCKS
// ============================================================

const mockQuery = vi.fn();
const mockHash = vi.fn();
const mockParseXlsx = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  pool: {
    query: mockQuery
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: mockHash
  }
}));

vi.mock('../../src/utils/xlsx.js', () => ({
  parseXlsx: mockParseXlsx
}));

// ============================================================
// IMPORT CONTROLLER
// ============================================================

const {
  getUsers,
  getUserById,
  createUser,
  importStudentsFile,
  importStudents,
  updateUser,
  getStudentAcademicOverview,
  saveFinalGrade,
  updateMyGithubUsername,
  deleteUser
} = await import('../../src/controllers/users.controller.js');


// ============================================================
// HELPERS
// ============================================================

function createRes() {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);

  return res;
}


function getError(handler) {
  return new Promise((resolve) => {
    handler({}, {}, (error) => resolve(error));
  });
}


async function runHandler(handler, req, res) {
  return new Promise((resolve, reject) => {

    const next = (error) => {
      if (error) reject(error);
      else resolve();
    };

    Promise.resolve(handler(req, res, next))
      .then(resolve)
      .catch(reject);
  });
}


// ============================================================
// RESET
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
});


// ============================================================
// getUsers
// ============================================================

describe('getUsers', () => {

  it('returns all users for admin', async () => {

    const req = {
      user: {
        role: 'admin',
        sub: 1
      },
      query: {}
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          name: 'Admin',
          email: 'admin@test.com'
        }
      ]
    ]);

    await runHandler(getUsers, req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 1,
      data: [
        expect.objectContaining({
          id: 1
        })
      ]
    });
  });


  it('filters users by role for admin', async () => {

    const req = {
      user: {
        role: 'admin',
        sub: 1
      },
      query: {
        role: 'student'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await runHandler(getUsers, req, res);

    expect(mockQuery).toHaveBeenCalled();

    const [, params] = mockQuery.mock.calls[0];

    expect(params).toContain('student');
  });


  it('limits teacher to students in their groups', async () => {

    const req = {
      user: {
        role: 'teacher',
        sub: 55
      },
      query: {}
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await runHandler(getUsers, req, res);

    const [sql, params] = mockQuery.mock.calls[0];

    expect(sql).toContain("u.role = 'student'");

    expect(sql).toContain('group_teachers');

    expect(params).toContain(55);
  });


  it('filters active users', async () => {

    const req = {
      user: {
        role: 'admin',
        sub: 1
      },
      query: {
        is_active: 'true'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await runHandler(getUsers, req, res);

    const [, params] = mockQuery.mock.calls[0];

    expect(params).toContain(true);
  });


  it('filters inactive users', async () => {

    const req = {
      user: {
        role: 'admin',
        sub: 1
      },
      query: {
        is_active: 'false'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await runHandler(getUsers, req, res);

    const [, params] = mockQuery.mock.calls[0];

    expect(params).toContain(false);
  });


  it('searches by name email and github username', async () => {

    const req = {
      user: {
        role: 'admin',
        sub: 1
      },
      query: {
        search: 'rana'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await runHandler(getUsers, req, res);

    const [, params] = mockQuery.mock.calls[0];

    expect(params).toContain('%rana%');
  });

});


// ============================================================
// getUserById
// ============================================================

describe('getUserById', () => {

  it('allows admin to access any user', async () => {

    const req = {
      params: {
        id: '5'
      },
      user: {
        role: 'admin',
        sub: 1
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 5,
          name: 'Student'
        }
      ]
    ]);

    await runHandler(getUserById, req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: 5,
        name: 'Student'
      }
    });
  });


  it('allows user to access own profile', async () => {

    const req = {
      params: {
        id: '10'
      },
      user: {
        role: 'student',
        sub: 10
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10
        }
      ]
    ]);

    await runHandler(getUserById, req, res);

    expect(res.json).toHaveBeenCalled();
  });


  it('allows teacher to access student in assigned group', async () => {

    const req = {
      params: {
        id: '20'
      },
      user: {
        role: 'teacher',
        sub: 99
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 20,
          role: 'student'
        }
      ]
    ]);

    await runHandler(getUserById, req, res);

    expect(res.json).toHaveBeenCalled();
  });


  it('rejects teacher without access', async () => {

    const req = {
      params: {
        id: '20'
      },
      user: {
        role: 'teacher',
        sub: 99
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(getUserById, req, res)
    ).rejects.toMatchObject({
      statusCode: 403
    });
  });

});


// ============================================================
// createUser
// ============================================================

describe('createUser', () => {

  it('creates a student successfully', async () => {

    const req = {
      body: {
        name: 'Rana',
        email: 'RANA@TEST.COM',
        password: 'password123',
        role: 'student'
      }
    };

    const res = createRes();

    // ensureUniqueUser email
    mockQuery.mockResolvedValueOnce([[]]);

    // bcrypt
    mockHash.mockResolvedValueOnce('hashed-password');

    // insert user
    mockQuery.mockResolvedValueOnce([
      {
        insertId: 10
      }
    ]);

    // getUserRows
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          name: 'Rana',
          email: 'rana@test.com'
        }
      ]
    ]);

    await runHandler(createUser, req, res);

    expect(mockHash).toHaveBeenCalledWith(
      'password123',
      10
    );

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'User created successfully'
      })
    );
  });


  it('rejects missing required fields', async () => {

    const req = {
      body: {
        name: 'Rana'
      }
    };

    const res = createRes();

    await expect(
      runHandler(createUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects invalid role', async () => {

    const req = {
      body: {
        name: 'Rana',
        email: 'rana@test.com',
        password: 'password123',
        role: 'superhero'
      }
    };

    const res = createRes();

    await expect(
      runHandler(createUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects duplicate email', async () => {

    const req = {
      body: {
        name: 'Rana',
        email: 'rana@test.com',
        password: 'password123',
        role: 'student'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1
        }
      ]
    ]);

    await expect(
      runHandler(createUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 409
    });
  });

});


// ============================================================
// importStudents
// ============================================================

describe('importStudents', () => {

  it('rejects empty students array', async () => {

    const req = {
      body: {
        students: []
      }
    };

    const res = createRes();

    await expect(
      runHandler(importStudents, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('imports a valid student', async () => {

    const req = {
      body: {
        students: [
          {
            name: 'Rana',
            surname: 'Test',
            email: 'rana@test.com',
            password: 'password123'
          }
        ]
      }
    };

    const res = createRes();

    // existing email
    mockQuery.mockResolvedValueOnce([[]]);

    mockHash.mockResolvedValueOnce('hashed-password');

    // insert
    mockQuery.mockResolvedValueOnce([
      {
        insertId: 50
      }
    ]);

    await runHandler(importStudents, req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        imported: 1,
        skipped: 0
      })
    );
  });


  it('skips row with missing name', async () => {

    const req = {
      body: {
        students: [
          {
            email: 'test@test.com'
          }
        ]
      }
    };

    const res = createRes();

    await runHandler(importStudents, req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        imported: 0,
        skipped: 1
      })
    );
  });


  it('skips duplicate email', async () => {

    const req = {
      body: {
        students: [
          {
            name: 'Rana',
            email: 'rana@test.com'
          }
        ]
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1
        }
      ]
    ]);

    await runHandler(importStudents, req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        imported: 0,
        skipped: 1
      })
    );
  });

});


// ============================================================
// importStudentsFile
// ============================================================

describe('importStudentsFile', () => {

  it('rejects non-xlsx files', async () => {

    const req = {
      body: {
        file_base64: 'abc',
        filename: 'students.csv'
      }
    };

    const res = createRes();

    await expect(
      runHandler(importStudentsFile, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('parses xlsx and imports students', async () => {

    const req = {
      body: {
        file_base64:
          Buffer.from('fake-file').toString('base64'),
        filename: 'students.xlsx'
      }
    };

    const res = createRes();

    mockParseXlsx.mockReturnValue([
      {
        name: 'Rana',
        email: 'rana@test.com'
      }
    ]);

    // importStudents duplicate check
    mockQuery.mockResolvedValueOnce([[]]);

    mockHash.mockResolvedValueOnce('hashed');

    // insert student
    mockQuery.mockResolvedValueOnce([
      {
        insertId: 10
      }
    ]);

    await runHandler(importStudentsFile, req, res);

    expect(mockParseXlsx).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(201);
  });


  it('returns readable excel error', async () => {

    const req = {
      body: {
        file_base64: 'abc',
        filename: 'students.xlsx'
      }
    };

    const res = createRes();

    mockParseXlsx.mockImplementation(() => {
      throw new Error('Invalid workbook');
    });

    await expect(
      runHandler(importStudentsFile, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

});


// ============================================================
// updateUser
// ============================================================

describe('updateUser', () => {

  it('allows user to update own name', async () => {

    const req = {
      params: {
        id: '10'
      },

      user: {
        sub: 10,
        role: 'student'
      },

      body: {
        name: 'New Name'
      }
    };

    const res = createRes();

    // existing user
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          role: 'student'
        }
      ]
    ]);

    // update
    mockQuery.mockResolvedValueOnce([{}]);

    // get updated user
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          name: 'New Name'
        }
      ]
    ]);

    await runHandler(updateUser, req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true
      })
    );
  });


  it('rejects updating another user without admin access', async () => {

    const req = {
      params: {
        id: '20'
      },

      user: {
        sub: 10,
        role: 'student'
      },

      body: {
        name: 'Hack'
      }
    };

    const res = createRes();

    await expect(
      runHandler(updateUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 403
    });
  });


  it('rejects invalid role', async () => {

    const req = {
      params: {
        id: '10'
      },

      user: {
        sub: 1,
        role: 'admin'
      },

      body: {
        role: 'invalid-role'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          role: 'student'
        }
      ]
    ]);

    await expect(
      runHandler(updateUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects short password', async () => {

    const req = {
      params: {
        id: '10'
      },

      user: {
        sub: 10,
        role: 'student'
      },

      body: {
        password: '123'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          role: 'student'
        }
      ]
    ]);

    await expect(
      runHandler(updateUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects empty update request', async () => {

    const req = {
      params: {
        id: '10'
      },

      user: {
        sub: 10,
        role: 'student'
      },

      body: {}
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          role: 'student'
        }
      ]
    ]);

    await expect(
      runHandler(updateUser, req, res)
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

});


// ============================================================
// getStudentAcademicOverview
// ============================================================

describe('getStudentAcademicOverview', () => {

  function createOverviewRequest() {

    return {
      params: {
        id: '10'
      },

      query: {
        group_id: '5'
      },

      user: {
        sub: 99,
        role: 'teacher'
      }
    };
  }


  it('returns complete academic overview', async () => {

    const req = createOverviewRequest();
    const res = createRes();

    // student
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10,
          name: 'Rana',
          email: 'rana@test.com'
        }
      ]
    ]);

    // membership
    mockQuery.mockResolvedValueOnce([
      [
        {
          group_id: 5,
          group_name: 'Group A',
          course_id: 1,
          course_name: 'React'
        }
      ]
    ]);

    // teacher access
    mockQuery.mockResolvedValueOnce([
      [
        {
          value: 1
        }
      ]
    ]);

    // assessments
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          title: 'Assignment',
          max_score: 100,
          score: 80
        }
      ]
    ]);

    // checklist
    mockQuery.mockResolvedValueOnce([
      [
        {
          assessment_id: 1,
          checklist_criterion_id: 1,
          name: 'Correctness',
          criterion_type: 'score',
          max_score: 10,
          sort_order: 1,

          submission_id: 1,
          ai_evaluation_id: 1,
          result_id: 1,

          ai_yes_no_value: null,
          ai_score_value: 8,
          ai_text_value: null,
          ai_feedback: 'Good',

          teacher_yes_no_value: null,
          teacher_score_value: null,
          teacher_text_value: null,
          teacher_feedback: null
        }
      ]
    ]);

    // quizzes
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          title: 'Quiz',
          max_score: 100,
          score: 90
        }
      ]
    ]);

    // attendance
    mockQuery.mockResolvedValueOnce([
      [
        {
          total_sessions: 10,
          attended_sessions: 8,
          absent_sessions: 1,
          late_sessions: 1,
          excused_sessions: 0
        }
      ]
    ]);

    // final grade
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          score: 85
        }
      ]
    ]);

    await runHandler(
      getStudentAcademicOverview,
      req,
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({

          student: expect.objectContaining({
            id: 10
          }),

          assessments: expect.any(Array),

          quizzes: expect.any(Array),

          attendance: expect.objectContaining({
            percentage: 80
          }),

          summary: expect.objectContaining({
            academic_average: 85
          }),

          final_grade: expect.objectContaining({
            score: 85
          })

        })
      })
    );
  });


  it('rejects invalid student id', async () => {

    const req = {
      params: {
        id: 'invalid'
      },

      query: {
        group_id: '5'
      },

      user: {
        sub: 1,
        role: 'teacher'
      }
    };

    const res = createRes();

    await expect(
      runHandler(
        getStudentAcademicOverview,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects missing group id', async () => {

    const req = {
      params: {
        id: '10'
      },

      query: {},

      user: {
        sub: 1,
        role: 'teacher'
      }
    };

    const res = createRes();

    await expect(
      runHandler(
        getStudentAcademicOverview,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('returns 404 when student does not exist', async () => {

    const req = createOverviewRequest();
    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(
        getStudentAcademicOverview,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });


  it('returns 404 when student is not in group', async () => {

    const req = createOverviewRequest();
    const res = createRes();

    // student exists
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10
        }
      ]
    ]);

    // no membership
    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(
        getStudentAcademicOverview,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });


  it('rejects teacher without group access', async () => {

    const req = createOverviewRequest();
    const res = createRes();

    // student
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10
        }
      ]
    ]);

    // membership
    mockQuery.mockResolvedValueOnce([
      [
        {
          group_id: 5
        }
      ]
    ]);

    // no teacher access
    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(
        getStudentAcademicOverview,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 403
    });
  });


  it('returns null averages when nothing is graded', async () => {

    const req = createOverviewRequest();
    const res = createRes();

    mockQuery
      // student
      .mockResolvedValueOnce([
        [
          {
            id: 10
          }
        ]
      ])

      // membership
      .mockResolvedValueOnce([
        [
          {
            group_id: 5
          }
        ]
      ])

      // access
      .mockResolvedValueOnce([[{}]])

      // assessments
      .mockResolvedValueOnce([[]])

      // quizzes
      .mockResolvedValueOnce([[]])

      // attendance
      .mockResolvedValueOnce([
        [
          {
            total_sessions: 0
          }
        ]
      ])

      // final grade
      .mockResolvedValueOnce([[]]);

    await runHandler(
      getStudentAcademicOverview,
      req,
      res
    );

    const response =
      res.json.mock.calls[0][0];

    expect(
      response.data.summary.academic_average
    ).toBeNull();

    expect(
      response.data.attendance.percentage
    ).toBeNull();
  });


  it('uses teacher checklist value instead of AI value', async () => {

    const req = createOverviewRequest();
    const res = createRes();

    mockQuery
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ group_id: 5 }]])
      .mockResolvedValueOnce([[{}]])

      .mockResolvedValueOnce([
        [
          {
            id: 1,
            max_score: 100,
            score: 80
          }
        ]
      ])

      .mockResolvedValueOnce([
        [
          {
            assessment_id: 1,
            checklist_criterion_id: 1,
            name: 'Code quality',
            criterion_type: 'score',
            max_score: 10,
            sort_order: 1,

            teacher_score_value: 10,
            ai_score_value: 5,

            teacher_yes_no_value: null,
            ai_yes_no_value: null,

            teacher_text_value: null,
            ai_text_value: null,

            teacher_feedback: 'Teacher feedback',
            ai_feedback: 'AI feedback'
          }
        ]
      ])

      .mockResolvedValueOnce([[]])

      .mockResolvedValueOnce([
        [
          {
            total_sessions: 0
          }
        ]
      ])

      .mockResolvedValueOnce([[]]);

    await runHandler(
      getStudentAcademicOverview,
      req,
      res
    );

    const response =
      res.json.mock.calls[0][0];

    const criterion =
      response.data.assessments[0]
        .checklist[0];

    expect(
      criterion.final.score_value
    ).toBe(10);

    expect(
      criterion.final.feedback
    ).toBe('Teacher feedback');
  });

});


// ============================================================
// saveFinalGrade
// ============================================================

describe('saveFinalGrade', () => {

  function createFinalGradeRequest(
    overrides = {}
  ) {

    return {
      params: {
        id: '10'
      },

      body: {
        group_id: '5',
        score: '85',
        comment: 'Good work'
      },

      user: {
        sub: 99,
        role: 'teacher'
      },

      ...overrides
    };
  }


  it('saves final grade successfully', async () => {

    const req =
      createFinalGradeRequest();

    const res = createRes();

    // student membership
    mockQuery.mockResolvedValueOnce([
      [
        {
          value: 1
        }
      ]
    ]);

    // teacher access
    mockQuery.mockResolvedValueOnce([
      [
        {
          value: 1
        }
      ]
    ]);

    // insert/update
    mockQuery.mockResolvedValueOnce([{}]);

    // select final grade
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          student_id: 10,
          group_id: 5,
          score: 85,
          comment: 'Good work',
          teacher_id: 99
        }
      ]
    ]);

    await runHandler(
      saveFinalGrade,
      req,
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message:
          'Final grade saved successfully'
      })
    );
  });


  it('rejects invalid student id', async () => {

    const req =
      createFinalGradeRequest({
        params: {
          id: 'abc'
        }
      });

    const res = createRes();

    await expect(
      runHandler(
        saveFinalGrade,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects invalid group id', async () => {

    const req =
      createFinalGradeRequest({
        body: {
          group_id: 'abc',
          score: 80
        }
      });

    const res = createRes();

    await expect(
      runHandler(
        saveFinalGrade,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects score below zero', async () => {

    const req =
      createFinalGradeRequest({
        body: {
          group_id: 5,
          score: -1
        }
      });

    const res = createRes();

    await expect(
      runHandler(
        saveFinalGrade,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects score above 100', async () => {

    const req =
      createFinalGradeRequest({
        body: {
          group_id: 5,
          score: 101
        }
      });

    const res = createRes();

    await expect(
      runHandler(
        saveFinalGrade,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('returns 404 when student is not enrolled', async () => {

    const req =
      createFinalGradeRequest();

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(
        saveFinalGrade,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });


  it('rejects teacher without group access', async () => {

    const req =
      createFinalGradeRequest();

    const res = createRes();

    // student membership
    mockQuery.mockResolvedValueOnce([[{}]]);

    // teacher access denied
    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(
        saveFinalGrade,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 403
    });
  });


  it('allows admin to save final grade without teacher access check', async () => {

    const req =
      createFinalGradeRequest({
        user: {
          sub: 1,
          role: 'admin'
        }
      });

    const res = createRes();

    // membership
    mockQuery.mockResolvedValueOnce([[{}]]);

    // insert/update
    mockQuery.mockResolvedValueOnce([{}]);

    // select
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 1,
          score: 90
        }
      ]
    ]);

    await runHandler(
      saveFinalGrade,
      req,
      res
    );

    expect(res.json).toHaveBeenCalled();
  });

});


// ============================================================
// updateMyGithubUsername
// ============================================================

describe('updateMyGithubUsername', () => {

  it('updates github username', async () => {

    const req = {
      user: {
        sub: 10
      },

      body: {
        github_username: '@rana'
      }
    };

    const res = createRes();

    // check existing
    mockQuery.mockResolvedValueOnce([[]]);

    // update
    mockQuery.mockResolvedValueOnce([{}]);

    await runHandler(
      updateMyGithubUsername,
      req,
      res
    );

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message:
        'GitHub username updated successfully.',
      data: {
        user_id: 10,
        github_username: 'rana'
      }
    });
  });


  it('rejects invalid github username', async () => {

    const req = {
      user: {
        sub: 10
      },

      body: {}
    };

    const res = createRes();

    await expect(
      runHandler(
        updateMyGithubUsername,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });


  it('rejects duplicate github username', async () => {

    const req = {
      user: {
        sub: 10
      },

      body: {
        github_username: 'existing'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 20
        }
      ]
    ]);

    await expect(
      runHandler(
        updateMyGithubUsername,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 409
    });
  });

});


// ============================================================
// deleteUser
// ============================================================

describe('deleteUser', () => {

  it('deletes existing user', async () => {

    const req = {
      params: {
        id: '10'
      }
    };

    const res = createRes();

    // user exists
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: 10
        }
      ]
    ]);

    // delete
    mockQuery.mockResolvedValueOnce([{}]);

    await runHandler(
      deleteUser,
      req,
      res
    );

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'User deleted successfully'
    });
  });


  it('returns 404 when user does not exist', async () => {

    const req = {
      params: {
        id: '999'
      }
    };

    const res = createRes();

    mockQuery.mockResolvedValueOnce([[]]);

    await expect(
      runHandler(
        deleteUser,
        req,
        res
      )
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });

});