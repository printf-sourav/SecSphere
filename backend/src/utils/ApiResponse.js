class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = true;
  }

  toJSON() {
    return {
      success: this.success,
      data: this.data,
      message: this.message,
    };
  }
}

export default ApiResponse;