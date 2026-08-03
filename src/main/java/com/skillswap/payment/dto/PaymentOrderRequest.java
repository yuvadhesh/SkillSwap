package com.skillswap.payment.dto;

public class PaymentOrderRequest {
    private Double amount;
    private String currency;
    private String userId;

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}
